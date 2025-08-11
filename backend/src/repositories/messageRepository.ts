import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const createScheduledMessage = (
    channelId: string,
    message: string,
    sendAt: Date,
    installationId: string,
    sendAsUser: boolean
) => {
    return prisma.scheduledMessage.create({
        data: {
            channelId,
            message,
            sendAt,
            installationId,
            sendAsUser: sendAsUser,
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

// New method to find a specific scheduled message
export const findScheduledMessageById = (id: string) => {
    return prisma.scheduledMessage.findUnique({
        where: { id }
    });
};

export const deleteScheduledMessageById = (id: string) => {
    return prisma.scheduledMessage.delete({ where: { id } });
};

export const deleteMessagesByInstallationId = (installationId: string) => {
    return prisma.scheduledMessage.deleteMany({ where: { installationId } });
};

export const findAndMarkDueMessages = async () => {
    const dueMessages = await prisma.scheduledMessage.findMany({
        where: {
            sendAt: { lte: new Date() },
            status: 'PENDING',
        },
        include: { installation: true },
    });

    if (dueMessages.length > 0) {
        await prisma.scheduledMessage.updateMany({
            where: { id: { in: dueMessages.map(msg => msg.id) } },
            data: { status: 'PROCESSING' },
        });
    }

    return dueMessages;
};

export const updateMessageStatus = (id: string, status: 'SENT' | 'FAILED') => {
    return prisma.scheduledMessage.update({
        where: { id },
        data: { status },
    });
};