import { Request, Response } from 'express';
import { WebClient } from '@slack/web-api';
import { getValidAccessToken } from '../services/tokenService.js';
import * as installationRepo from '../repositories/installationRepository.js';
import * as messageRepo from '../repositories/messageRepository.js';
import type { Installation } from '@slack/oauth';
import crypto from 'crypto';

/**
 * Retrieves the list of public Slack channels the authenticated user is a member of.
 */
export const getChannels = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const teamId = req.user?.teamId;

        if (!userId || !teamId) {
            return res.status(401).json({ error: 'User not authenticated properly.' });
        }

        const token = await getValidAccessToken(teamId, userId);
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

/**
 * Sends a message to a specified Slack channel, either as the user or as the bot.
 * FIXED: Added as_user parameter for user messages, improved error handling
 */
export const sendMessage = async (req: Request, res: Response) => {
    const { channelId, message, sendAsUser } = req.body;

    console.log('Sending message with params:', { channelId, message, sendAsUser: !!sendAsUser });

    if (!channelId || !message) {
        return res.status(400).json({ error: 'Channel ID and message are required.' });
    }

    try {
        const userId = req.user?.userId;
        const teamId = req.user?.teamId;

        if (!userId || !teamId) {
            return res.status(401).json({ error: 'User not authenticated properly.' });
        }

        const installation = await installationRepo.findInstallationByTeamIdAndUserId(teamId, userId);
        if (!installation) {
            return res.status(404).json({ error: 'Installation not found for user.' });
        }

        const installationData = installation.data as unknown as Installation;

        let token;
        if (sendAsUser) {
            token = installationData.user?.token;
            if (!token) return res.status(400).json({ error: 'User token not found.' });
        } else {
            token = installationData.bot?.token;
            if (!token) return res.status(400).json({ error: 'Bot token not found.' });
        }

        const client = new WebClient(token);

        // FIX: Add as_user parameter when sending as user
        const messageParams: any = {
            channel: channelId,
            text: message,
        };

        // When sending as user, explicitly set as_user to true
        if (sendAsUser) {
            messageParams.as_user = true;
        }

        console.log('Sending with params:', messageParams);

        const result = await client.chat.postMessage(messageParams);

        // FIX: Better error handling with Slack API responses
        if (!result.ok) {
            console.error('Slack API error:', result.error);
            return res.status(400).json({
                error: 'Slack API error',
                details: result.error
            });
        }

        res.status(200).json({ success: true, message: 'Message sent successfully.' });

    } catch (error: any) {
        console.error('Failed to send message:', error.response?.data || error);

        // FIX: Return more detailed error information
        if (error.response?.data) {
            return res.status(error.response.status || 500).json({
                error: 'Failed to send message',
                details: error.response.data
            });
        }

        res.status(500).json({ error: 'Failed to send message' });
    }
};

/**
 * Schedules a message to be sent at a future date/time for the authenticated user.
 * FIXED: Proper timestamp conversion and error handling
 */
export const scheduleMessage = async (req: Request, res: Response) => {
    const { channelId, message, sendAt, sendAsUser } = req.body;

    console.log('Schedule request:', {
        channelId,
        message: message.substring(0, 20) + '...',
        sendAt,
        sendAsUser: !!sendAsUser
    });

    try {
        const userId = req.user?.userId;
        const teamId = req.user?.teamId;

        if (!userId || !teamId) {
            return res.status(401).json({ error: 'User not authenticated properly.' });
        }

        const installation = await installationRepo.findInstallationByTeamIdAndUserId(teamId, userId);
        if (!installation) {
            return res.status(404).json({ error: 'Installation not found for user.' });
        }

        const installationData = installation.data as unknown as Installation;

        // Get the appropriate token based on sendAsUser
        let token;
        if (sendAsUser) {
            token = installationData.user?.token;
            if (!token) return res.status(400).json({ error: 'User token not found.' });
        } else {
            token = installationData.bot?.token;
            if (!token) return res.status(400).json({ error: 'Bot token not found.' });
        }

        // FIX: Convert date to Unix timestamp in seconds (not milliseconds)
        const scheduledTime = Math.floor(new Date(sendAt).getTime() / 1000);

        console.log('Scheduling for:', {
            originalTime: sendAt,
            convertedTime: new Date(scheduledTime * 1000).toISOString(),
            unixTimestamp: scheduledTime
        });

        // Now we'll actually schedule with Slack API
        const client = new WebClient(token);

        const scheduleParams: any = {
            channel: channelId,
            text: message,
            post_at: scheduledTime // This is the key part - proper timestamp format
        };

        // When scheduling as user, we need to use as_user flag
        if (sendAsUser) {
            scheduleParams.as_user = true;
        }

        console.log('Sending schedule params to Slack:', scheduleParams);

        const result = await client.chat.scheduleMessage(scheduleParams);

        if (!result.ok) {
            console.error('Slack API scheduling error:', result.error);
            return res.status(400).json({
                error: 'Failed to schedule message with Slack',
                details: result.error
            });
        }

        console.log('Slack API schedule success:', {
            scheduled_message_id: result.scheduled_message_id,
            channel: result.channel,
            post_at: result.post_at
        });

        // Store the scheduled message in our database (without Slack's ID since our schema doesn't have that field)
        await messageRepo.createScheduledMessage(
            channelId,
            message,
            new Date(sendAt),
            installation.id,
            sendAsUser
        );

        res.status(200).json({
            success: true,
            message: 'Message scheduled successfully.',
            scheduled_time: new Date(scheduledTime * 1000).toISOString()
        });
    } catch (error: any) {
        console.error('Failed to schedule message:', error.response?.data || error);

        // FIX: Better error handling
        if (error.response?.data) {
            return res.status(error.response.status || 500).json({
                error: 'Failed to schedule message',
                details: error.response.data
            });
        }

        res.status(500).json({ error: 'Failed to schedule message' });
    }
};

/**
 * Retrieves all pending scheduled messages for the authenticated user.
 */
export const getScheduledMessages = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const teamId = req.user?.teamId;

        if (!userId || !teamId) {
            return res.status(401).json({ error: 'User not authenticated properly.' });
        }

        const installation = await installationRepo.findInstallationByTeamIdAndUserId(teamId, userId);
        if (!installation) {
            return res.status(404).json({ error: 'No installation found for user.' });
        }

        const messages = await messageRepo.findPendingMessagesByInstallationId(installation.id);
        res.json(messages);
    } catch (error) {
        console.error('Failed to fetch scheduled messages:', error);
        res.status(500).json({ error: 'Failed to fetch scheduled messages' });
    }
};

/**
 * Cancels a scheduled message by ID for the authenticated user.
 */
export const cancelScheduledMessage = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const userId = req.user?.userId;
        const teamId = req.user?.teamId;

        if (!userId || !teamId) {
            return res.status(401).json({ error: 'User not authenticated properly.' });
        }

        const installation = await installationRepo.findInstallationByTeamIdAndUserId(teamId, userId);
        if (!installation) {
            return res.status(404).json({ error: 'Installation not found for user.' });
        }

        const message = await messageRepo.findScheduledMessageById(id);
        if (!message) {
            return res.status(404).json({ error: 'Message not found.' });
        }

        if (message.installationId !== installation.id) {
            return res.status(403).json({ error: 'You are not authorized to cancel this message.' });
        }

        await messageRepo.deleteScheduledMessageById(id);
        res.status(200).json({ success: true, message: 'Message cancelled successfully.' });
    } catch (error) {
        console.error(`Failed to cancel message ID ${id}:`, error);
        res.status(500).json({ error: 'Failed to cancel message' });
    }
};

/**
 * Logs out the authenticated user, deleting their session and installation.
 */
export const logout = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const teamId = req.user?.teamId;

        if (!userId || !teamId) {
            return res.status(401).json({ error: 'User not authenticated properly.' });
        }

        const installation = await installationRepo.findInstallationByTeamIdAndUserId(teamId, userId);
        if (!installation) {
            return res.status(404).json({ error: 'No installation found for user.' });
        }

        await messageRepo.deleteMessagesByInstallationId(installation.id);
        await installationRepo.deleteInstallationByTeamIdAndUserId(teamId, userId);

        if (req.headers.authorization) {
            const token = req.headers.authorization.split(' ')[1];
            await installationRepo.deleteSession(token);
        }

        res.status(200).json({ success: true, message: 'Successfully logged out.' });
    } catch (error) {
        console.error('Failed to logout:', error);
        res.status(500).json({ error: 'Failed to logout' });
    }
};

/**
 * Logs in a user by userId and teamId, creating a session token if installation exists.
 */
export const login = async (req: Request, res: Response) => {
    try {
        const { userId, teamId } = req.body;

        if (!userId || !teamId) {
            return res.status(400).json({ error: 'User ID and Team ID are required.' });
        }

        const installation = await installationRepo.findInstallationByTeamIdAndUserId(teamId, userId);

        if (!installation) {
            return res.status(404).json({ error: 'Installation not found. Please connect your Slack workspace first.' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await installationRepo.createUserSession(userId, teamId, token, expiresAt);

        res.status(200).json({
            success: true,
            token,
            expiresAt,
            userId,
            teamId
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
};