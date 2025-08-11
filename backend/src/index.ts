import express from 'express';
import cors from 'cors';
import type { IncomingMessage, ServerResponse } from 'http';
import { InstallProvider } from '@slack/oauth';
import type { Installation, InstallURLOptions } from '@slack/oauth';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import apiRoutes from './routes/apiRoutes.js';
import startScheduler from "./jobs/messageScheduler.js";
// Add this import to fix the first error
import * as installationRepo from './repositories/installationRepository.js';

const prisma = new PrismaClient();

const installer = new InstallProvider({
    clientId: process.env.SLACK_CLIENT_ID || '',
    clientSecret: process.env.SLACK_CLIENT_SECRET || '',
    stateVerification: false, // This disables the default cookie-based state store
    stateStore: {
        generateStateParam: async (): Promise<string> => {
            const state = crypto.randomBytes(16).toString('hex');
            await prisma.oAuthState.create({ data: { state } });
            return state;
        },
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
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

app.get('/slack/install', async (req, res) => {
    try {
        const url = await installer.generateInstallUrl({
            scopes: ['chat:write', 'channels:read'], // These are BOT scopes
            userScopes: ['chat:write'],             // User scopes
            redirectUri: `${process.env.BACKEND_PUBLIC_URL}/auth/slack/callback`,
        });
        res.redirect(url);
    } catch (error) {
        console.error('Error generating install URL:', error);
        res.status(500).send('Error generating Slack installation URL');
    }
});

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

                // Fix the user name access issue with a safer approach
                // Convert the installation to a plain object first
                const rawData = JSON.parse(JSON.stringify(installation));
                let userName = 'Slack User'; // Default fallback

                // Try to extract the user name from the raw data
                if (rawData && rawData.user) {
                    userName =
                        rawData.user.name ||
                        rawData.user.real_name ||
                        (rawData.user.profile ? rawData.user.profile.real_name || rawData.user.profile.display_name : null) ||
                        userName;
                }

                // Encode the user info and token to pass to frontend
                const userInfo = {
                    token,
                    userId,
                    teamId,
                    userName,
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

app.get('/', (req, res) => {
    res.send('Slack Connect backend is running! ✅');
});

app.use('/api', apiRoutes);

app.listen(port, () => {
    console.log(`[server]: Server is running at ${process.env.BACKEND_PUBLIC_URL}`);
    startScheduler();
});