import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { WebClient } from '@slack/web-api';
// We no longer need to import Installation here
// import { Installation } from '@slack/oauth';
import { getValidAccessToken } from '../services/tokenService.js'; // <-- Import the new service

const prisma = new PrismaClient();

// This is a helper to get the team ID. For now it's hardcoded.
// In a multi-tenant app, you'd get this from the user's session or a request header.
const getTeamId = async (): Promise<string | null> => {
    const installation = await prisma.slackInstallation.findFirst();
    return installation?.teamId || null;
}

export const getChannels = async (req: Request, res: Response) => {
    try {
        const teamId = await getTeamId();
        if (!teamId) return res.status(404).json({ error: 'No installation found.' });

        // --- Use the new service to get a token ---
        const botToken = await getValidAccessToken(teamId);
        if (!botToken) return res.status(400).json({ error: 'Could not retrieve a valid token.' });

        const client = new WebClient(botToken);
        const result = await client.conversations.list({ types: 'public_channel' });
        const memberChannels = result.channels?.filter(channel => channel.is_member === true);
        res.json(memberChannels);

    } catch (error) {
        console.error('Failed to fetch channels:', error);
        res.status(500).json({ error: 'Failed to fetch channels' });
    }
};

export const sendMessage = async (req: Request, res: Response) => {
    const { channelId, message } = req.body;
    if (!channelId || !message) return res.status(400).json({ error: 'Channel ID and message are required.' });

    try {
        const teamId = await getTeamId();
        if (!teamId) return res.status(404).json({ error: 'No installation found.' });

        // --- Use the new service to get a token ---
        const botToken = await getValidAccessToken(teamId);
        if (!botToken) return res.status(400).json({ error: 'Could not retrieve a valid token.' });

        const client = new WebClient(botToken);
        await client.chat.postMessage({
            channel: channelId,
            text: message,
        });
        res.status(200).json({ success: true, message: 'Message sent successfully.' });

    } catch (error) {
        console.error('Failed to send message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
};

export const scheduleMessage = async (req: Request, res: Response) => {
    const { channelId, message, sendAt } = req.body;
    if (!channelId || !message || !sendAt) {
        return res.status(400).json({ error: 'Channel ID, message, and sendAt are required.' });
    }
    try {
        const installation = await prisma.slackInstallation.findFirst();
        if (!installation) {
            return res.status(404).json({ error: 'No Slack installation found.' });
        }
        await prisma.scheduledMessage.create({
            data: {
                channelId,
                message,
                sendAt: new Date(sendAt),
                installation: {
                    connect: { id: installation.id },
                },
            },
        });
        res.status(200).json({ success: true, message: 'Message scheduled successfully.' });
    } catch (error) {
        console.error('Failed to schedule message:', error);
        res.status(500).json({ error: 'Failed to schedule message' });
    }
};

export const getScheduledMessages = async (req: Request, res: Response) => {
    try {
        const installation = await prisma.slackInstallation.findFirst();
        if (!installation) {
            return res.status(404).json({ error: 'No Slack installation found.' });
        }
        const messages = await prisma.scheduledMessage.findMany({
            where: {
                installationId: installation.id,
                status: 'PENDING',
            },
            orderBy: {
                sendAt: 'asc',
            },
        });
        res.json(messages);
    } catch (error) {
        console.error('Failed to fetch scheduled messages:', error);
        res.status(500).json({ error: 'Failed to fetch scheduled messages' });
    }
};

export const cancelScheduledMessage = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await prisma.scheduledMessage.delete({
            where: {
                id: id,
            },
        });
        res.status(200).json({ success: true, message: 'Message cancelled successfully.' });
    } catch (error) {
        console.error(`Failed to cancel message ID ${id}:`, error);
        res.status(500).json({ error: 'Failed to cancel message' });
    }
};