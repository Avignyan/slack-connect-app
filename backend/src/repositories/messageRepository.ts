import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const createScheduledMessage = (channelId: string, message: string, sendAt: Date, installationId: string) => {
    return prisma.scheduledMessage.create({
        data: {
            channelId,
            message,
            sendAt,
            installationId,
        },
    });
};

export const findPendingMessagesByInstallationId = (installationId: string) => {
    return prisma.scheduledMessage.findMany({
        where: {
            installationId,
            status: 'PENDING',
        },
        orderBy: { sendAt: 'asc' },
    });
};

export const deleteScheduledMessageById = (id: string) => {
    return prisma.scheduledMessage.delete({ where: { id } });
};

export const findAndMarkDueMessages = async () => {
    const dueMessages = await prisma.scheduledMessage.findMany({
        where: {
            sendAt: { lte: new Date() },
            status: 'PENDING',
        },
        include: { installation: true },
    });

    // Mark as 'PROCESSING' to prevent other schedulers from picking them up
    await prisma.scheduledMessage.updateMany({
        where: { id: { in: dueMessages.map(msg => msg.id) } },
        data: { status: 'PROCESSING' },
    });

    return dueMessages;
};

export const updateMessageStatus = (id: string, status: 'SENT' | 'FAILED') => {
    return prisma.scheduledMessage.update({
        where: { id },
        data: { status },
    });
};

export const deleteMessagesByInstallationId = (installationId: string) => {
    return prisma.scheduledMessage.deleteMany({ where: { installationId } });
};