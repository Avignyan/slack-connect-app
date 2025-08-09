import cron from 'node-cron';
import { WebClient } from '@slack/web-api';
import { Installation } from '@slack/oauth';
import { findAndMarkDueMessages, updateMessageStatus } from '../repositories/messageRepository.js';

const sendDueMessages = async () => {
    console.log('Scheduler: Checking for due messages...');

    // 1. Get due messages from the repository. The repo handles the complex query.
    const dueMessages = await findAndMarkDueMessages();

    if (dueMessages.length > 0) {
        console.log(`Scheduler: Found ${dueMessages.length} message(s) to send.`);
    }

    for (const msg of dueMessages) {
        try {
            const installationData = msg.installation.data as unknown as Installation;
            const token = installationData.bot?.token;

            if (!token) {
                throw new Error(`No token for team ${msg.installation.teamId}`);
            }

            const client = new WebClient(token);
            await client.chat.postMessage({
                channel: msg.channelId,
                text: msg.message,
            });

            // 2. Tell the repository to update the status to SENT
            await updateMessageStatus(msg.id, 'SENT');
            console.log(`Scheduler: Successfully sent message ID ${msg.id}`);

        } catch (error) {
            console.error(`Scheduler: Failed to send message ID ${msg.id}:`, error);
            // 3. Tell the repository to update the status to FAILED
            await updateMessageStatus(msg.id, 'FAILED');
        }
    }
};

const startScheduler = () => {
    cron.schedule('* * * * *', sendDueMessages);
    console.log('Message scheduler started, will check for messages every minute.');
};

export default startScheduler;