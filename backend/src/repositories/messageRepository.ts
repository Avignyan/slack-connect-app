import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Creates a new scheduled message in the database.
 * @param channelId The Slack channel ID where the message will be sent.
 * @param message The message content.
 * @param sendAt The date and time to send the message.
 * @param installationId The installation ID associated with the message.
 * @param sendAsUser Whether to send as the user or bot.
 * @returns {Promise<ScheduledMessage>} The created scheduled message.
 */
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

/**
 * Finds all pending scheduled messages for a given installation ID.
 * @param installationId The installation ID to filter messages.
 * @returns {Promise<ScheduledMessage[]>} Array of pending scheduled messages.
 */
export const findPendingMessagesByInstallationId = (installationId: string) => {
    return prisma.scheduledMessage.findMany({
        where: {
            installationId,
            status: 'PENDING',
        },
        orderBy: { sendAt: 'asc' },
    });
};

/**
 * Finds a scheduled message by its unique ID.
 * @param id The message ID.
 * @returns {Promise<ScheduledMessage | null>} The scheduled message or null if not found.
 */
export const findScheduledMessageById = (id: string) => {
    return prisma.scheduledMessage.findUnique({
        where: { id }
    });
};

/**
 * Deletes a scheduled message by its unique ID.
 * @param id The message ID.
 * @returns {Promise<ScheduledMessage>} The deleted scheduled message.
 */
export const deleteScheduledMessageById = (id: string) => {
    return prisma.scheduledMessage.delete({ where: { id } });
};

/**
 * Deletes all scheduled messages for a given installation ID.
 * @param installationId The installation ID to filter messages.
 * @returns {Promise<Prisma.BatchPayload>} The result of the delete operation.
 */
export const deleteMessagesByInstallationId = (installationId: string) => {
    return prisma.scheduledMessage.deleteMany({ where: { installationId } });
};

/**
 * Finds all due messages (where sendAt <= now and status is PENDING), marks them as PROCESSING, and returns them.
 * Includes installation data for each message.
 * @returns {Promise<ScheduledMessage[]>} Array of due scheduled messages.
 */
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

/**
 * Updates the status of a scheduled message.
 * @param id The message ID.
 * @param status The new status ('SENT' or 'FAILED').
 * @returns {Promise<ScheduledMessage>} The updated scheduled message.
 */
export const updateMessageStatus = (id: string, status: 'SENT' | 'FAILED') => {
    return prisma.scheduledMessage.update({
        where: { id },
        data: { status },
    });
};