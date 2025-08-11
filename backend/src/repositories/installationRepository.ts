import { PrismaClient } from '@prisma/client';
import { Installation } from '@slack/oauth';

const prisma = new PrismaClient();

export const findFirstInstallation = () => {
    return prisma.slackInstallation.findFirst();
};

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

export const findInstallationByTeamId = (teamId: string) => {
    return prisma.slackInstallation.findFirst({ where: { teamId } });
};

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

export const deleteInstallationByTeamId = (teamId: string) => {
    return prisma.slackInstallation.deleteMany({ where: { teamId } });
};

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

export const getSessionByToken = (token: string) => {
    return prisma.userSession.findUnique({
        where: { token }
    });
};

export const deleteSession = (token: string) => {
    return prisma.userSession.delete({
        where: { token }
    });
};

export const deleteExpiredSessions = () => {
    return prisma.userSession.deleteMany({
        where: {
            expiresAt: {
                lt: new Date()
            }
        }
    });
};

export const getAllUserInstallations = (userId: string) => {
    return prisma.slackInstallation.findMany({
        where: { userId }
    });
};

export const getAllTeamInstallations = (teamId: string) => {
    return prisma.slackInstallation.findMany({
        where: { teamId }
    });
};