import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { WebClient } from '@slack/web-api';
import { Installation } from '@slack/oauth';

const prisma = new PrismaClient();

// This function will contain the logic to check for and send messages
const sendDueMessages = async () => {
    console.log('Scheduler: Checking for due messages...');

    const dueMessages = await prisma.scheduledMessage.findMany({
        where: {
            sendAt: { lte: new Date() }, // Find messages where sendAt is in the past
            status: 'PENDING',
        },
        include: {
            installation: true, // Also fetch the installation data (for the token)
        },
    });

    if (dueMessages.length > 0) {
        console.log(`Scheduler: Found ${dueMessages.length} message(s) to send.`);
    }

    // Loop through each due message and send it
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

            // Update the message status to 'SENT' so it doesn't send again
            await prisma.scheduledMessage.update({
                where: { id: msg.id },
                data: { status: 'SENT' },
            });

            console.log(`Scheduler: Successfully sent message ID ${msg.id}`);

        } catch (error) {
            console.error(`Scheduler: Failed to send message ID ${msg.id}:`, error);
            // Update status to 'FAILED' to prevent retries
            await prisma.scheduledMessage.update({
                where: { id: msg.id },
                data: { status: 'FAILED' },
            });
        }
    }
};

// This function starts the cron job
const startScheduler = () => {
    // This cron expression means "run every minute"
    cron.schedule('* * * * *', sendDueMessages);
    console.log('Message scheduler started, will check for messages every minute.');
};

export default startScheduler;