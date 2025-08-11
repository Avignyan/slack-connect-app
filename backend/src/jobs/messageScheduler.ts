import cron from 'node-cron';
import { WebClient } from '@slack/web-api';
import { Installation } from '@slack/oauth';
import { findAndMarkDueMessages, updateMessageStatus } from '../repositories/messageRepository.js';

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

const startScheduler = () => {
    cron.schedule('* * * * *', sendDueMessages);
    console.log('Message scheduler started, will check for messages every minute.');
};

export default startScheduler;