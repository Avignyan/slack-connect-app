import { Request, Response } from 'express';
import { WebClient } from '@slack/web-api';
import { getValidAccessToken } from '../services/tokenService.js';
import * as installationRepo from '../repositories/installationRepository.js';
import * as messageRepo from '../repositories/messageRepository.js';
import type { Installation } from '@slack/oauth';
import crypto from 'crypto';

/**
 * Retrieves the list of public Slack channels the authenticated user is a member of.
 *
 * Route: GET /api/channels
 *
 * Authentication: Requires a valid user session (req.user).
 *
 * Response:
 *   - 200: Array of channel objects the user is a member of.
 *   - 401: If user is not authenticated.
 *   - 400: If a valid token cannot be retrieved.
 *   - 500: On server or Slack API error.
 */
export const getChannels = async (req: Request, res: Response) => {
    try {
        // Get the authenticated user's info from the request
        const userId = req.user?.userId;
        const teamId = req.user?.teamId;

        if (!userId || !teamId) {
            return res.status(401).json({ error: 'User not authenticated properly.' });
        }

        // Get a valid token for this specific user and team
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
 *
 * Route: POST /api/send-message
 *
 * Request Body:
 *   - channelId: The ID of the Slack channel to send the message to.
 *   - message: The message text to send.
 *   - sendAsUser: (optional) Boolean, if true sends as the user, otherwise as the bot.
 *
 * Authentication: Requires a valid user session (req.user).
 *
 * Response:
 *   - 200: On successful message send.
 *   - 400: If required fields are missing or token cannot be retrieved.
 *   - 500: On server or Slack API error.
 */
export const sendMessage = async (req: Request, res: Response) => {
    const { channelId, message, sendAsUser } = req.body;

    if (!channelId || !message) {
        return res.status(400).json({ error: 'Channel ID and message are required.' });
    }

    try {
        // Get the authenticated user's info from the request
        const userId = req.user?.userId;
        const teamId = req.user?.teamId;

        if (!userId || !teamId) {
            return res.status(401).json({ error: 'User not authenticated properly.' });
        }

        // Find the specific installation for this user
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

/**
 * Schedules a message to be sent at a future date/time for the authenticated user.
 *
 * Route: POST /api/schedule-message
 *
 * Request Body:
 *   - channelId: The ID of the Slack channel.
 *   - message: The message text.
 *   - sendAt: The date/time to send the message (ISO string).
 *   - sendAsUser: (optional) Boolean, if true sends as the user, otherwise as the bot.
 *
 * Authentication: Requires a valid user session (req.user).
 *
 * Response:
 *   - 200: On successful scheduling.
 *   - 401/404: If user or installation not found.
 *   - 500: On server error.
 */
export const scheduleMessage = async (req: Request, res: Response) => {
    const { channelId, message, sendAt, sendAsUser } = req.body;
    try {
        // Get the authenticated user's info
        const userId = req.user?.userId;
        const teamId = req.user?.teamId;

        if (!userId || !teamId) {
            return res.status(401).json({ error: 'User not authenticated properly.' });
        }

        // Find the specific installation for this user
        const installation = await installationRepo.findInstallationByTeamIdAndUserId(teamId, userId);
        if (!installation) {
            return res.status(404).json({ error: 'Installation not found for user.' });
        }

        await messageRepo.createScheduledMessage(
            channelId,
            message,
            new Date(sendAt),
            installation.id,
            sendAsUser
        );
        res.status(200).json({ success: true, message: 'Message scheduled successfully.' });
    } catch (error) {
        console.error('Failed to schedule message:', error);
        res.status(500).json({ error: 'Failed to schedule message' });
    }
};

/**
 * Retrieves all pending scheduled messages for the authenticated user.
 *
 * Route: GET /api/scheduled-messages
 *
 * Authentication: Requires a valid user session (req.user).
 *
 * Response:
 *   - 200: Array of scheduled message objects.
 *   - 401/404: If user or installation not found.
 *   - 500: On server error.
 */
export const getScheduledMessages = async (req: Request, res: Response) => {
    try {
        // Get the authenticated user's info
        const userId = req.user?.userId;
        const teamId = req.user?.teamId;

        if (!userId || !teamId) {
            return res.status(401).json({ error: 'User not authenticated properly.' });
        }

        // Find the specific installation for this user
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
 *
 * Route: DELETE /api/scheduled-messages/:id
 *
 * Authentication: Requires a valid user session (req.user).
 *
 * Response:
 *   - 200: On successful cancellation.
 *   - 401/403/404: If user not authorized or message not found.
 *   - 500: On server error.
 */
export const cancelScheduledMessage = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        // First verify that this message belongs to the authenticated user
        const userId = req.user?.userId;
        const teamId = req.user?.teamId;

        if (!userId || !teamId) {
            return res.status(401).json({ error: 'User not authenticated properly.' });
        }

        const installation = await installationRepo.findInstallationByTeamIdAndUserId(teamId, userId);
        if (!installation) {
            return res.status(404).json({ error: 'Installation not found for user.' });
        }

        // Get the message and check if it belongs to this user's installation
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
 *
 * Route: POST /api/logout
 *
 * Authentication: Requires a valid user session (req.user).
 *
 * Response:
 *   - 200: On successful logout.
 *   - 401/404: If user or installation not found.
 *   - 500: On server error.
 */
export const logout = async (req: Request, res: Response) => {
    try {
        // Get the authenticated user's info
        const userId = req.user?.userId;
        const teamId = req.user?.teamId;

        if (!userId || !teamId) {
            return res.status(401).json({ error: 'User not authenticated properly.' });
        }

        // Find the specific installation for this user
        const installation = await installationRepo.findInstallationByTeamIdAndUserId(teamId, userId);
        if (!installation) {
            return res.status(404).json({ error: 'No installation found for user.' });
        }

        // 1. Delete all child records (scheduled messages) first
        await messageRepo.deleteMessagesByInstallationId(installation.id);

        // 2. Delete the specific user's installation
        await installationRepo.deleteInstallationByTeamIdAndUserId(teamId, userId);

        // 3. Delete the user's session
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
 *
 * Route: POST /api/login
 *
 * Request Body:
 *   - userId: Slack user ID.
 *   - teamId: Slack team ID.
 *
 * Response:
 *   - 200: On successful login (returns token, userId, teamId, expiresAt).
 *   - 400/404: If required fields missing or installation not found.
 *   - 500: On server error.
 */
export const login = async (req: Request, res: Response) => {
    try {
        const { userId, teamId } = req.body;

        if (!userId || !teamId) {
            return res.status(400).json({ error: 'User ID and Team ID are required.' });
        }

        // Find the installation for this user and team
        const installation = await installationRepo.findInstallationByTeamIdAndUserId(teamId, userId);

        if (!installation) {
            return res.status(404).json({ error: 'Installation not found. Please connect your Slack workspace first.' });
        }

        // Generate a session token
        const token = crypto.randomBytes(32).toString('hex');

        // Set token expiration to 30 days from now
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        // Store the session
        await installationRepo.createUserSession(userId, teamId, token, expiresAt);

        // Return the token to the client
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