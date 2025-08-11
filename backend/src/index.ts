import express from 'express';
import cors from 'cors';
import type { IncomingMessage, ServerResponse } from 'http';
import { InstallProvider } from '@slack/oauth';
import type { Installation, InstallURLOptions } from '@slack/oauth';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import apiRoutes from './routes/apiRoutes.js';
import startScheduler from "./jobs/messageScheduler.js";
import * as installationRepo from './repositories/installationRepository.js';
import { WebClient } from '@slack/web-api';

const prisma = new PrismaClient();

const installer = new InstallProvider({
    clientId: process.env.SLACK_CLIENT_ID || '',
    clientSecret: process.env.SLACK_CLIENT_SECRET || '',
    stateVerification: false, // This disables the default cookie-based state store
    stateStore: {
        /**
         * Generates a random state parameter for Slack OAuth and stores it in the database.
         *
         * @returns {Promise<string>} The generated state string.
         */
        generateStateParam: async (): Promise<string> => {
            const state = crypto.randomBytes(16).toString('hex');
            await prisma.oAuthState.create({ data: { state } });
            return state;
        },
        /**
         * Verifies the provided state parameter exists in the database for Slack OAuth.
         *
         * @param _now - Current time (unused)
         * @param state - The state string to verify
         * @returns {Promise<InstallURLOptions>} The install URL options if state is valid
         * @throws {Error} If the state is invalid or not found
         */
        verifyStateParam: async (_now, state): Promise<InstallURLOptions> => {
            const result = await prisma.oAuthState.findUnique({ where: { state } });
            if (result) {
                await prisma.oAuthState.delete({ where: { state } });
                return { scopes: [] };
            }
            throw new Error('Invalid state parameter');
        },
    },
    installationStore: {
        /**
         * Stores a Slack installation in the database, keyed by team and user ID.
         *
         * @param installation - The Slack installation object
         * @throws {Error} If the team ID is missing
         */
        storeInstallation: async (installation: Installation) => {
            if (!installation.team?.id) {
                throw new Error('Failed to store installation: Team ID is missing.');
            }

            // Use userId from the installation or default if not available
            const userId = installation.user?.id || 'default';

            await prisma.slackInstallation.upsert({
                where: {
                    teamId_userId: {
                        teamId: installation.team.id,
                        userId: userId
                    }
                },
                update: { data: installation as any },
                create: {
                    teamId: installation.team.id,
                    userId: userId,
                    data: installation as any,
                },
            });
        },
        /**
         * Fetches a Slack installation from the database by team and (optionally) user ID.
         *
         * @param query - The query object containing teamId and optionally userId
         * @returns {Promise<Installation>} The installation data
         * @throws {Error} If the team ID is missing or installation is not found
         */
        fetchInstallation: async (query) => {
            if (!query.teamId) {
                throw new Error('Failed to fetch installation: Team ID is missing.');
            }

            // Use userId from query if available, otherwise default to find first match for the team
            if (query.userId) {
                const result = await prisma.slackInstallation.findUnique({
                    where: {
                        teamId_userId: {
                            teamId: query.teamId,
                            userId: query.userId
                        }
                    },
                });
                if (result) {
                    return result.data as unknown as Installation;
                }
            }

            // Fallback to finding any installation for the team
            const result = await prisma.slackInstallation.findFirst({
                where: { teamId: query.teamId },
            });

            if (result === null) {
                throw new Error('Installation not found.');
            }

            return result.data as unknown as Installation;
        },
    },
});

const app = express();

app.use(cors());
app.use(express.json());

/**
 * Express route handler to initiate Slack OAuth installation.
 *
 * Redirects the user to Slack's authorization page with required scopes.
 *
 * Route: GET /slack/install
 */
app.get('/slack/install', async (req, res) => {
    try {
        const url = await installer.generateInstallUrl({
            scopes: [
                'chat:write',        // To send messages
                'channels:read',     // To read public channels
                'groups:read',       // To read private channels
                'im:read',           // To read direct messages
                'mpim:read',         // To read group DMs
                'users:read'         // To read user profiles (can be bot scope too)
            ],
            userScopes: [
                'chat:write',        // For sending messages as user
                'users:read'         // For reading user's own profile
            ],
            redirectUri: `${process.env.BACKEND_PUBLIC_URL}/auth/slack/callback`,
        });
        res.redirect(url);
    } catch (error) {
        console.error('Error generating install URL:', error);
        res.status(500).send('Error generating Slack installation URL');
    }
});

/**
 * Express route handler to initiate Slack OAuth installation for a new workspace.
 *
 * Redirects the user to Slack's authorization page with required scopes.
 *
 * Route: GET /slack/install-new-workspace
 */
app.get('/slack/install-new-workspace', async (req, res) => {
    try {
        const url = await installer.generateInstallUrl({
            scopes: [
                'chat:write',
                'channels:read',
                'groups:read',
                'im:read',
                'mpim:read',
                'users:read'
            ],
            userScopes: [
                'chat:write',
                'users:read'
            ],
            redirectUri: `${process.env.BACKEND_PUBLIC_URL}/auth/slack/callback`,
        });
        res.redirect(url);
    } catch (error) {
        console.error('Error generating install URL:', error);
        res.status(500).send('Error generating Slack installation URL');
    }
});

/**
 * Express route handler for Slack OAuth callback.
 *
 * Handles the OAuth callback, creates a user session, fetches user profile info, and redirects to the frontend.
 *
 * Route: GET /auth/slack/callback
 */
app.get('/auth/slack/callback', async (req, res) => {
    await installer.handleCallback(req, res as unknown as ServerResponse, {
        success: async (installation, options, req, res) => {
            try {
                // Extract user information from the installation
                const userId = installation.user?.id;
                const teamId = installation.team?.id;

                if (!userId || !teamId) {
                    console.error('Missing user or team ID in installation');
                    res.writeHead(302, { 'Location': `${process.env.FRONTEND_URL}/error?message=missing_user_info` });
                    res.end();
                    return;
                }

                // Create a session token for the user
                const token = crypto.randomBytes(32).toString('hex');

                // Set expiration to 30 days from now
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 30);

                // Store the session
                await installationRepo.createUserSession(userId, teamId, token, expiresAt);

                // Initialize default values
                let userName = 'Slack User';
                let teamName = installation.team?.name || 'Slack Workspace';
                let teamIcon = null;

                // Convert the installation to a plain object
                const rawData = JSON.parse(JSON.stringify(installation));

                // Try to get team icon if available
                if (rawData.team && rawData.team.icons) {
                    teamIcon =
                        rawData.team.icons.image_132 ||
                        rawData.team.icons.image_68 ||
                        rawData.team.icons.image_44 ||
                        null;
                }

                try {
                    // Use the user token to get profile information
                    if (installation.user?.token) {
                        const client = new WebClient(installation.user.token);
                        const userInfo = await client.users.info({
                            user: userId
                        });

                        console.log('Fetched user profile:', JSON.stringify(userInfo.user, null, 2));

                        if (userInfo.user) {
                            // Extract user name from fetched profile
                            userName =
                                userInfo.user.real_name ||
                                userInfo.user.name ||
                                (userInfo.user.profile ?
                                    userInfo.user.profile.real_name ||
                                    userInfo.user.profile.display_name :
                                    null) ||
                                userName;

                            console.log(`Using fetched user name: ${userName}`);
                        }
                    }
                } catch (profileError) {
                    console.error('Error fetching user profile:', profileError);
                    // Continue with default name if profile fetch fails
                }

                // Encode the user info and token to pass to frontend
                const userInfo = {
                    token,
                    userId,
                    teamId,
                    userName,
                    teamName,
                    teamIcon,
                    expiresAt: expiresAt.toISOString()
                };

                // URL encode the user info for the redirect
                const encodedUserInfo = encodeURIComponent(JSON.stringify(userInfo));

                // Redirect to the frontend with the user info
                res.writeHead(302, {
                    'Location': `${process.env.FRONTEND_URL}?userInfo=${encodedUserInfo}`
                });
                res.end();
            } catch (error) {
                console.error('Error in OAuth callback success handler:', error);
                res.writeHead(302, { 'Location': process.env.FRONTEND_URL || '' });
                res.end();
            }
        },
        failure: (error, options, req, res) => {
            console.error('OAuth failure:', error);
            res.writeHead(302, { 'Location': `${process.env.FRONTEND_URL}/error?message=auth_failed` });
            res.end();
        },
    });
});

/**
 * Health check endpoint for the backend server.
 *
 * Route: GET /
 */
app.get('/', (req, res) => {
    res.send('Slack Connect backend is running! ✅');
});

app.use('/api', apiRoutes);

// Start the server only in development mode
// In production (Netlify Functions), serverless handler will manage this
if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 8000;
    app.listen(port, () => {
        console.log(`[server]: Server is running at ${process.env.BACKEND_PUBLIC_URL}`);
        startScheduler();
    });
} else {
    // In production, start the scheduler without explicitly starting the server
    startScheduler();
}

// Export the Express app for Netlify Functions
export { app };