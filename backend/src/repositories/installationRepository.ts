import { PrismaClient } from '@prisma/client';
import { Installation } from '@slack/oauth';

const prisma = new PrismaClient();

export const findFirstInstallation = () => {
    return prisma.slackInstallation.findFirst();
};

export const findInstallationByTeamId = (teamId: string) => {
    return prisma.slackInstallation.findUnique({ where: { teamId } });
};

export const storeInstallation = (installation: Installation) => {
    if (!installation.team?.id) {
        throw new Error('Team ID is missing from installation data.');
    }
    return prisma.slackInstallation.upsert({
        where: { teamId: installation.team.id },
        update: { data: installation as any },
        create: {
            teamId: installation.team.id,
            data: installation as any,
        },
    });
};

export const deleteInstallationByTeamId = (teamId: string) => {
    return prisma.slackInstallation.delete({ where: { teamId } });
};