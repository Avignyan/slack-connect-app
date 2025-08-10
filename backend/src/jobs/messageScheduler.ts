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

            // --- This is the new logic ---
            if (msg.sendAsUser) {
                token = installationData.user?.token;
                console.log(`Scheduler: Sending message ID ${msg.id} as user.`);
            } else {
                token = installationData.bot?.token;
                console.log(`Scheduler: Sending message ID ${msg.id} as bot.`);
            }

            if (!token) {
                throw new Error(`Could not find a valid token for message ID ${msg.id}`);
            }
            // --- End of new logic ---

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