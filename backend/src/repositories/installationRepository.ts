import { PrismaClient } from '@prisma/client';
import { Installation } from '@slack/oauth';

const prisma = new PrismaClient();

/**
 * Finds the first Slack installation in the database.
 * @returns {Promise<SlackInstallation | null>} The first installation or null if none found.
 */
export const findFirstInstallation = () => {
    return prisma.slackInstallation.findFirst();
};

/**
 * Finds a Slack installation by team ID and user ID.
 * @param teamId The Slack team ID.
 * @param userId The Slack user ID.
 * @returns {Promise<SlackInstallation | null>} The installation or null if not found.
 */
export const findInstallationByTeamIdAndUserId = (teamId: string, userId: string) => {
    return prisma.slackInstallation.findUnique({
        where: {
            teamId_userId: {
                teamId,
                userId
            }
        }
    });
};

/**
 * Finds a Slack installation by team ID.
 * @param teamId The Slack team ID.
 * @returns {Promise<SlackInstallation | null>} The installation or null if not found.
 */
export const findInstallationByTeamId = (teamId: string) => {
    return prisma.slackInstallation.findFirst({ where: { teamId } });
};

/**
 * Stores a Slack installation in the database, keyed by team and user ID.
 * @param installation The Slack installation object.
 * @throws {Error} If the team ID is missing from installation data.
 * @returns {Promise<SlackInstallation>} The upserted installation.
 */
export const storeInstallation = (installation: Installation) => {
    if (!installation.team?.id) {
        throw new Error('Team ID is missing from installation data.');
    }

    const userId = installation.user?.id || 'default';

    return prisma.slackInstallation.upsert({
        where: {
            teamId_userId: {
                teamId: installation.team.id,
                userId: userId
            }
        },
        update: { data: installation as any },
        create: {
            teamId: installation.team.id,
            userId: userId,
            data: installation as any,
        },
    });
};

/**
 * Deletes all Slack installations for a given team ID.
 * @param teamId The Slack team ID.
 * @returns {Promise<Prisma.BatchPayload>} The result of the delete operation.
 */
export const deleteInstallationByTeamId = (teamId: string) => {
    return prisma.slackInstallation.deleteMany({ where: { teamId } });
};

/**
 * Deletes a Slack installation by team ID and user ID.
 * @param teamId The Slack team ID.
 * @param userId The Slack user ID.
 * @returns {Promise<SlackInstallation>} The deleted installation.
 */
export const deleteInstallationByTeamIdAndUserId = (teamId: string, userId: string) => {
    return prisma.slackInstallation.delete({
        where: {
            teamId_userId: {
                teamId,
                userId
            }
        }
    });
};

// User Session Management Functions

/**
 * Creates or updates a user session in the database.
 * @param userId The Slack user ID.
 * @param teamId The Slack team ID.
 * @param token The session token.
 * @param expiresAt The expiration date of the session.
 * @returns {Promise<UserSession>} The upserted user session.
 */
export const createUserSession = (userId: string, teamId: string, token: string, expiresAt: Date) => {
    return prisma.userSession.upsert({
        where: {
            userId_teamId: {
                userId,
                teamId
            }
        },
        update: {
            token,
            expiresAt
        },
        create: {
            userId,
            teamId,
            token,
            expiresAt
        }
    });
};

/**
 * Finds a user session by user ID and team ID.
 * @param userId The Slack user ID.
 * @param teamId The Slack team ID.
 * @returns {Promise<UserSession | null>} The user session or null if not found.
 */
export const findUserSession = (userId: string, teamId: string) => {
    return prisma.userSession.findUnique({
        where: {
            userId_teamId: {
                userId,
                teamId
            }
        }
    });
};

/**
 * Finds a user session by session token.
 * @param token The session token.
 * @returns {Promise<UserSession | null>} The user session or null if not found.
 */
export const getSessionByToken = (token: string) => {
    return prisma.userSession.findUnique({
        where: { token }
    });
};

/**
 * Deletes a user session by session token.
 * @param token The session token.
 * @returns {Promise<UserSession>} The deleted user session.
 */
export const deleteSession = (token: string) => {
    return prisma.userSession.delete({
        where: { token }
    });
};

/**
 * Deletes all expired user sessions from the database.
 * @returns {Promise<Prisma.BatchPayload>} The result of the delete operation.
 */
export const deleteExpiredSessions = () => {
    return prisma.userSession.deleteMany({
        where: {
            expiresAt: {
                lt: new Date()
            }
        }
    });
};

/**
 * Gets all Slack installations for a given user ID.
 * @param userId The Slack user ID.
 * @returns {Promise<SlackInstallation[]>} Array of installations for the user.
 */
export const getAllUserInstallations = (userId: string) => {
    return prisma.slackInstallation.findMany({
        where: { userId }
    });
};

/**
 * Gets all Slack installations for a given team ID.
 * @param teamId The Slack team ID.
 * @returns {Promise<SlackInstallation[]>} Array of installations for the team.
 */
export const getAllTeamInstallations = (teamId: string) => {
    return prisma.slackInstallation.findMany({
        where: { teamId }
    });
};