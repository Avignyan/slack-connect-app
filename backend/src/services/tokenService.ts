import { PrismaClient } from '@prisma/client';
import { WebClient } from '@slack/web-api';
import { Installation } from '@slack/oauth';

const prisma = new PrismaClient();

// This function will get an installation, check if the token is expiring,
// refresh it if needed, and return a valid token.
export const getValidAccessToken = async (teamId: string): Promise<string | null> => {
    // 1. Find the installation for the team
    const installation = await prisma.slackInstallation.findUnique({
        where: { teamId },
    });

    if (!installation) {
        return null;
    }

    const installationData = installation.data as unknown as Installation;

    // --- This is the new check to fix the error ---
    // If the bot object doesn't exist, we can't get a token.
    if (!installationData.bot) {
        console.error(`Installation for team ${teamId} is missing bot data.`);
        return null;
    }
    // --- End of new check ---

    const { expiresAt, refreshToken, token } = installationData.bot;

    if (!expiresAt || !refreshToken || !token) {
        // Cannot refresh without these values
        return token || null;
    }

    // 2. Check if the token is expiring in the next 10 minutes
    const tenMinutesFromNow = Date.now() + 10 * 60 * 1000;
    if (expiresAt * 1000 > tenMinutesFromNow) {
        // Token is not expiring soon, so it's valid
        return token;
    }

    console.log(`Access token for team ${teamId} is expiring. Refreshing now...`);

    // 3. If it's expiring, use the refresh token to get a new one
    try {
        const client = new WebClient();
        const refreshResult = await client.oauth.v2.access({
            client_id: process.env.SLACK_CLIENT_ID!,
            client_secret: process.env.SLACK_CLIENT_SECRET!,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        });

        // 4. Update the installation data with the new tokens
        const newInstallationData = {
            ...installationData,
            bot: {
                ...installationData.bot,
                token: refreshResult.access_token as string,
                refreshToken: refreshResult.refresh_token as string,
                expiresAt: Date.now() / 1000 + (refreshResult.expires_in as number),
            },
        };

        await prisma.slackInstallation.update({
            where: { id: installation.id },
            data: { data: newInstallationData as any },
        });

        console.log(`Successfully refreshed access token for team ${teamId}.`);

        // 5. Return the new access token
        return newInstallationData.bot.token;
    } catch (error) {
        console.error(`Error refreshing token for team ${teamId}:`, error);
        // If refresh fails, return null
        return null;
    }
};