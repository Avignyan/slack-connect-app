import { Request, Response } from 'express';
import { WebClient } from '@slack/web-api';
import type { ChatPostMessageArguments, ChatScheduleMessageArguments } from '@slack/web-api';
import { getValidAccessToken } from '../services/tokenService.js';
import * as installationRepo from '../repositories/installationRepository.js';
import * as messageRepo from '../repositories/messageRepository.js';
import crypto from 'crypto';

// Define interface for installation data structure
interface InstallationData {
    bot?: {
        token?: string;
    };
    user?: {
        token?: string;
    };
    authed_user?: {
        access_token?: string;
    };
    access_token?: string;
    bot_token?: string;
    user_token?: string;
}

/**
 * Retrieves the list of public Slack channels the authenticated user is a member of.
 *
 * Route: GET /api/channels
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
    } catch (error: any) {
        console.error('Failed to fetch channels:', error);
        res.status(500).json({ error: 'Failed to fetch channels', details: error.message });
    }
};

/**
 * Sends a message to a specified Slack channel, either as the user or as the bot.
 *
 * Route: POST /api/send-message
 */
export const sendMessage = async (req: Request, res: Response) => {
    const { channelId, message, sendAsUser } = req.body;

    console.log('Sending message with params:', {
        channelId,
        message: message?.substring(0, 20) + '...',
        sendAsUser: !!sendAsUser
    });

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

        // Cast installation data to our interface type
        const installationData = installation.data as unknown as InstallationData;

        // Find the appropriate token based on sendAsUser flag
        let token: string | undefined;

        if (sendAsUser) {
            // Try all possible locations for user token
            token = installationData.authed_user?.access_token ||
                installationData.user?.token ||
                installationData.user_token;

            if (!token) {
                return res.status(400).json({
                    error: 'User token not found. Make sure your app has user_scope permissions.'
                });
            }
        } else {
            // Try all possible locations for bot token
            token = installationData.bot?.token ||
                installationData.access_token ||
                installationData.bot_token;

            if (!token) {
                return res.status(400).json({ error: 'Bot token not found.' });
            }
        }

        console.log('Using token type:', sendAsUser ? 'user_token' : 'bot_token');

        const client = new WebClient(token);

        // Create properly typed message parameters
        const messageParams: ChatPostMessageArguments = {
            channel: channelId,
            text: message
        };

        // Only add as_user for user messages
        if (sendAsUser) {
            // Type assertion to allow adding as_user
            (messageParams as ChatPostMessageArguments & { as_user: boolean }).as_user = true;
        }

        console.log('Sending with params:', {
            channel: messageParams.channel,
            as_user: !!sendAsUser,
            text_preview: messageParams.text?.substring(0, 20) + '...'
        });

        const result = await client.chat.postMessage(messageParams);

        if (!result.ok) {
            console.error('Slack API error:', result.error);
            return res.status(400).json({
                error: 'Slack API error',
                details: result.error
            });
        }

        res.status(200).json({
            success: true,
            message: 'Message sent successfully.',
            sentAs: sendAsUser ? 'user' : 'bot'
        });

    } catch (error: any) {
        console.error('Failed to send message:', error.response?.data || error.message);

        // Better error details
        if (error.response?.data) {
            return res.status(error.response.status || 500).json({
                error: 'Failed to send message',
                details: error.response.data
            });
        }

        res.status(500).json({
            error: 'Failed to send message',
            details: error.message
        });
    }
};

/**
 * Schedules a message to be sent at a future date/time for the authenticated user.
 *
 * Route: POST /api/schedule-message
 */
export const scheduleMessage = async (req: Request, res: Response) => {
    const { channelId, message, sendAt, sendAsUser } = req.body;

    console.log('Schedule request:', {
        channelId,
        message: message?.substring(0, 20) + '...',
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

        // Cast installation data to our interface type
        const installationData = installation.data as unknown as InstallationData;

        // Find the appropriate token based on sendAsUser flag
        let token: string | undefined;

        if (sendAsUser) {
            // Try all possible locations for user token
            token = installationData.authed_user?.access_token ||
                installationData.user?.token ||
                installationData.user_token;

            if (!token) {
                return res.status(400).json({
                    error: 'User token not found. Make sure your app has user_scope permissions.'
                });
            }
        } else {
            // Try all possible locations for bot token
            token = installationData.bot?.token ||
                installationData.access_token ||
                installationData.bot_token;

            if (!token) {
                return res.status(400).json({ error: 'Bot token not found.' });
            }
        }

        // Parse the date string keeping the timezone as provided by user
        const clientDate = new Date(sendAt);

        // Log the date information for debugging
        console.log('Date information:', {
            original: sendAt,
            parsed: clientDate.toString(),
            utcISO: clientDate.toISOString(),
            localTimezoneName: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timestamp: Math.floor(clientDate.getTime() / 1000) // Convert to seconds for Slack API
        });

        // Convert to Unix timestamp in seconds for Slack API
        const scheduledTime = Math.floor(clientDate.getTime() / 1000);

        const client = new WebClient(token);

        // Create properly typed schedule parameters
        const scheduleParams: ChatScheduleMessageArguments = {
            channel: channelId,
            text: message,
            post_at: scheduledTime
        };

        // Only add as_user for user messages
        if (sendAsUser) {
            // Type assertion to allow adding as_user
            (scheduleParams as ChatScheduleMessageArguments & { as_user: boolean }).as_user = true;
        }

        console.log('Scheduling with params:', {
            channel: scheduleParams.channel,
            post_at: scheduleParams.post_at,
            as_user: !!sendAsUser,
            formattedTime: new Date(scheduledTime * 1000).toString()
        });

        // Call Slack API to schedule message
        const result = await client.chat.scheduleMessage(scheduleParams);

        if (!result.ok) {
            console.error('Slack API error:', result.error);
            return res.status(400).json({
                error: 'Slack API error',
                details: result.error
            });
        }

        // Store in our database
        await messageRepo.createScheduledMessage(
            channelId,
            message,
            clientDate,  // Store the original parsed date
            installation.id,
            sendAsUser
        );

        res.status(200).json({
            success: true,
            message: 'Message scheduled successfully.',
            scheduled_at: clientDate.toString(),
            scheduled_readable: clientDate.toLocaleString(),
            sentAs: sendAsUser ? 'user' : 'bot'
        });

    } catch (error: any) {
        console.error('Failed to schedule message:', error.response?.data || error.message);

        // Better error handling
        if (error.response?.data) {
            return res.status(error.response.status || 500).json({
                error: 'Failed to schedule message',
                details: error.response.data
            });
        }

        res.status(500).json({
            error: 'Failed to schedule message',
            details: error.message
        });
    }
};

/**
 * Retrieves all pending scheduled messages for the authenticated user.
 *
 * Route: GET /api/scheduled-messages
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
    } catch (error: any) {
        console.error('Failed to fetch scheduled messages:', error);
        res.status(500).json({ error: 'Failed to fetch scheduled messages', details: error.message });
    }
};

/**
 * Cancels a scheduled message by ID for the authenticated user.
 *
 * Route: DELETE /api/scheduled-messages/:id
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
    } catch (error: any) {
        console.error(`Failed to cancel message ID ${id}:`, error);
        res.status(500).json({ error: 'Failed to cancel message', details: error.message });
    }
};

/**
 * Logs out the authenticated user, deleting their session and installation.
 *
 * Route: POST /api/logout
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
    } catch (error: any) {
        console.error('Failed to logout:', error);
        res.status(500).json({ error: 'Failed to logout', details: error.message });
    }
};

/**
 * Logs in a user by userId and teamId, creating a session token if installation exists.
 *
 * Route: POST /api/login
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
    } catch (error: any) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login', details: error.message });
    }
};