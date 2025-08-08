import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // 1. Delete all scheduled messages first
    console.log('Deleting all scheduled messages...');
    const { count: msgCount } = await prisma.scheduledMessage.deleteMany({});
    console.log(`✅ Successfully deleted ${msgCount} message(s).`);

    // 2. Then, delete all Slack installations
    console.log('Deleting all Slack installations...');
    const { count: installCount } = await prisma.slackInstallation.deleteMany({});
    console.log(`✅ Successfully deleted ${installCount} installation(s).`);
}

main()
    .catch((e) => {
        console.error('An error occurred:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });