import { Request, Response } from 'express';
import { WebClient } from '@slack/web-api';
import { getValidAccessToken } from '../services/tokenService.js';
import * as installationRepo from '../repositories/installationRepository.js';
import * as messageRepo from '../repositories/messageRepository.js';

// This is a helper for our single-workspace app
const getFirstTeamId = async () => {
    const installation = await installationRepo.findFirstInstallation();
    return installation?.teamId || null;
};

export const getChannels = async (req: Request, res: Response) => {
    try {
        const teamId = await getFirstTeamId();
        if (!teamId) return res.status(404).json({ error: 'No installation found.' });

        const token = await getValidAccessToken(teamId);
        if (!token) return res.status(400).json({ error: 'Could not retrieve a valid token.' });

        const client = new WebClient(token);
        const result = await client.conversations.list({ types: 'public_channel' });
        const memberChannels = result.channels?.filter(ch => ch.is_member === true);

        res.json(memberChannels);
    } catch (error) {
        console.error('Failed to fetch channels:', error);
        res.status(500).json({ error: 'Failed to fetch channels' });
    }
};

export const sendMessage = async (req: Request, res: Response) => {
    const { channelId, message } = req.body;
    try {
        const teamId = await getFirstTeamId();
        if (!teamId) return res.status(404).json({ error: 'No installation found.' });

        const token = await getValidAccessToken(teamId);
        if (!token) return res.status(400).json({ error: 'Could not retrieve a valid token.' });

        const client = new WebClient(token);
        await client.chat.postMessage({ channel: channelId, text: message });

        res.status(200).json({ success: true, message: 'Message sent successfully.' });
    } catch (error) {
        console.error('Failed to send message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
};

export const scheduleMessage = async (req: Request, res: Response) => {
    const { channelId, message, sendAt } = req.body;
    try {
        const installation = await installationRepo.findFirstInstallation();
        if (!installation) return res.status(404).json({ error: 'No installation found.' });

        await messageRepo.createScheduledMessage(channelId, message, new Date(sendAt), installation.id);
        res.status(200).json({ success: true, message: 'Message scheduled successfully.' });
    } catch (error) {
        console.error('Failed to schedule message:', error);
        res.status(500).json({ error: 'Failed to schedule message' });
    }
};

export const getScheduledMessages = async (req: Request, res: Response) => {
    try {
        const installation = await installationRepo.findFirstInstallation();
        if (!installation) return res.status(404).json({ error: 'No messages found.' });

        const messages = await messageRepo.findPendingMessagesByInstallationId(installation.id);
        res.json(messages);
    } catch (error) {
        console.error('Failed to fetch scheduled messages:', error);
        res.status(500).json({ error: 'Failed to fetch scheduled messages' });
    }
};

export const cancelScheduledMessage = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await messageRepo.deleteScheduledMessageById(id);
        res.status(200).json({ success: true, message: 'Message cancelled successfully.' });
    } catch (error) {
        console.error(`Failed to cancel message ID ${id}:`, error);
        res.status(500).json({ error: 'Failed to cancel message' });
    }
};

// Add this function to backend/src/controllers/slackController.ts

export const logout = async (req: Request, res: Response) => {
    try {
        const installation = await installationRepo.findFirstInstallation();
        if (!installation) {
            return res.status(404).json({ error: 'No installation found to logout.' });
        }

        // 1. Delete all child records (scheduled messages) first
        await messageRepo.deleteMessagesByInstallationId(installation.id);

        // 2. Delete the parent record (the installation)
        await installationRepo.deleteInstallationByTeamId(installation.teamId);

        res.status(200).json({ success: true, message: 'Successfully logged out.' });
    } catch (error) {
        console.error('Failed to logout:', error);
        res.status(500).json({ error: 'Failed to logout' });
    }
};
