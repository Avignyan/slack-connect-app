import express from 'express';
import cors from 'cors';
import type { IncomingMessage, ServerResponse } from 'http';
import { InstallProvider } from '@slack/oauth';
import type { Installation, InstallURLOptions } from '@slack/oauth';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import apiRoutes from './routes/apiRoutes.js';
import startScheduler from "./jobs/messageScheduler.js";

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
            await prisma.slackInstallation.upsert({
                where: { teamId: installation.team.id },
                update: { data: installation as any },
                create: {
                    teamId: installation.team.id,
                    data: installation as any,
                },
            });
        },
        fetchInstallation: async (query) => {
            if (!query.teamId) {
                throw new Error('Failed to fetch installation: Team ID is missing.');
            }
            const result = await prisma.slackInstallation.findUnique({
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
            userScopes: ['chat:write'],             // <-- Add this line for USER scopes
            redirectUri: `${process.env.BACKEND_PUBLIC_URL}/auth/slack/callback`,
        });
        res.redirect(url);
    } catch (error) {
        // ...
    }
});

app.get('/auth/slack/callback', async (req, res) => {
    await installer.handleCallback(req, res as unknown as ServerResponse, {
        // This is the updated success handler
        success: (installation, options, req, res) => {
            // Redirect the user back to the frontend app
            res.writeHead(302, { 'Location': process.env.FRONTEND_URL || '' });
            res.end();
        },
        failure: (error, options, req, res) => {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Authentication failed. Please try again.');
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