/**
 * Message Scheduler Job
 *
 * This job runs on a schedule (every minute) to check for due scheduled messages in the database.
 * It sends each due message to Slack using the appropriate user or bot token, updates the message status,
 * and logs the result. Failed messages are marked as such for later review.
 *
 * Key Functions:
 * - sendDueMessages: Finds and sends all due messages, updating their status.
 * - startScheduler: Starts the cron job to run sendDueMessages every minute.
 *
 * Usage:
 * Call startScheduler() once when the backend server starts.
 */

import cron from 'node-cron';
import { WebClient } from '@slack/web-api';
import { Installation } from '@slack/oauth';
import { findAndMarkDueMessages, updateMessageStatus } from '../repositories/messageRepository.js';

/**
 * Finds and sends all due scheduled messages.
 * For each message:
 *   - Determines whether to use the user or bot token.
 *   - Sends the message to the specified Slack channel.
 *   - Updates the message status to SENT or FAILED.
 *   - Logs the result for monitoring.
 *
 * This function is intended to be run by a scheduler (cron job).
 */
const sendDueMessages = async () => {
    console.log('Scheduler: Checking for due messages...');
    const dueMessages = await findAndMarkDueMessages();

    if (dueMessages.length > 0) {
        console.log(`Scheduler: Found ${dueMessages.length} message(s) to send.`);
    }

    for (const msg of dueMessages) {
        try {
            const installationData = msg.installation.data as unknown as Installation;
            let token;

            // Get the appropriate token based on sendAsUser flag
            if (msg.sendAsUser) {
                token = installationData.user?.token;
                if (!token) {
                    throw new Error(`User token not found for message ID ${msg.id} (Installation ID: ${msg.installationId})`);
                }
                console.log(`Scheduler: Sending message ID ${msg.id} as user ${installationData.user?.id}.`);
            } else {
                token = installationData.bot?.token;
                if (!token) {
                    throw new Error(`Bot token not found for message ID ${msg.id} (Installation ID: ${msg.installationId})`);
                }
                console.log(`Scheduler: Sending message ID ${msg.id} as bot.`);
            }

            const client = new WebClient(token);
            await client.chat.postMessage({
                channel: msg.channelId,
                text: msg.message,
            });

            await updateMessageStatus(msg.id, 'SENT');
            console.log(`Scheduler: Successfully sent message ID ${msg.id}`);

        } catch (error) {
            console.error(`Scheduler: Failed to send message ID ${msg.id}:`, error);
            await updateMessageStatus(msg.id, 'FAILED');
        }
    }
};

/**
 * Starts the message scheduler cron job.
 * Runs sendDueMessages every minute.
 * Should be called once at server startup.
 */
const startScheduler = () => {
    cron.schedule('* * * * *', sendDueMessages);
    console.log('Message scheduler started, will check for messages every minute.');
};

export default startScheduler;