/**
 * Message Scheduler Job
 */
import cron from 'node-cron';
import { WebClient } from '@slack/web-api';
import type { ChatPostMessageArguments } from '@slack/web-api';
import { findAndMarkDueMessages, updateMessageStatus } from '../repositories/messageRepository.js';

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
 * Finds and sends all due scheduled messages.
 */
const sendDueMessages = async () => {
    console.log('Scheduler: Checking for due messages...');
    const dueMessages = await findAndMarkDueMessages();

    if (dueMessages.length > 0) {
        console.log(`Scheduler: Found ${dueMessages.length} message(s) to send.`);
    }

    for (const msg of dueMessages) {
        try {
            // Type assertion to help TypeScript understand the structure
            const installationData = msg.installation?.data as unknown as InstallationData;

            if (!installationData) {
                throw new Error(`Installation data not found for message ID ${msg.id}`);
            }

            let token: string | undefined;

            if (msg.sendAsUser) {
                // Look for user token in all possible locations
                token = installationData.authed_user?.access_token ||
                    installationData.user?.token ||
                    installationData.user_token;

                if (!token) {
                    throw new Error(`User token not found for message ID ${msg.id} (Installation ID: ${msg.installationId})`);
                }
                console.log(`Scheduler: Sending message ID ${msg.id} as user.`);
            } else {
                // Look for bot token in all possible locations
                token = installationData.bot?.token ||
                    installationData.access_token ||
                    installationData.bot_token;

                if (!token) {
                    throw new Error(`Bot token not found for message ID ${msg.id} (Installation ID: ${msg.installationId})`);
                }
                console.log(`Scheduler: Sending message ID ${msg.id} as bot.`);
            }

            const client = new WebClient(token);

            // Create properly typed message parameters
            const messageParams: ChatPostMessageArguments = {
                channel: msg.channelId,
                text: msg.message
            };

            // Only add as_user for user messages
            if (msg.sendAsUser) {
                // Type assertion to allow adding as_user
                (messageParams as ChatPostMessageArguments & { as_user: boolean }).as_user = true;
            }

            console.log(`Scheduler: Sending with params:`, {
                channel: messageParams.channel,
                as_user: msg.sendAsUser,
                text_preview: messageParams.text?.substring(0, 20) + '...'
            });

            const result = await client.chat.postMessage(messageParams);

            if (!result.ok) {
                throw new Error(`Slack API error: ${result.error || 'Unknown error'}`);
            }

            await updateMessageStatus(msg.id, 'SENT');
            console.log(`Scheduler: Successfully sent message ID ${msg.id}`);

        } catch (error: any) {
            console.error(`Scheduler: Failed to send message ID ${msg.id}:`, error);
            await updateMessageStatus(msg.id, 'FAILED');
        }
    }
};

/**
 * Starts the message scheduler cron job.
 */
const startScheduler = () => {
    cron.schedule('* * * * *', sendDueMessages);
    console.log('Message scheduler started, will check for messages every minute.');
};

export default startScheduler;