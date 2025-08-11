/**
 * Token Service for Slack OAuth
 *
 * This service provides utility functions to retrieve and refresh valid Slack access tokens (bot and user tokens)
 * for a given team and user. It ensures that tokens are always valid and refreshes them if they are close to expiring.
 *
 * Key Functions:
 * - getValidAccessToken: Retrieves a valid bot access token for a team/user, refreshing it if needed.
 * - getUserToken: Retrieves a user access token for a team/user.
 *
 * Token Refresh Logic:
 * - If a bot token is expiring within 10 minutes, it is refreshed using Slack's OAuth v2 refresh_token grant.
 * - The refreshed token and its metadata are persisted in the database.
 * - If refresh fails, the old token is returned (may still be valid for a short time).
 *
 * Usage:
 * Use these functions to always get a valid token before making Slack API calls on behalf of a user or bot.
 *
 * Environment Variables:
 * - SLACK_CLIENT_ID: Slack app client ID (required for token refresh)
 * - SLACK_CLIENT_SECRET: Slack app client secret (required for token refresh)
 */

import { WebClient } from '@slack/web-api';
import { Installation } from '@slack/oauth';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Retrieves a valid bot access token for a given team and (optionally) user.
 *
 * - If a userId is provided, attempts to find a user-specific installation first.
 * - If the token is expiring within 10 minutes, it is refreshed.
 * - Falls back to team-level installation if user-specific is not found.
 *
 * @param teamId Slack team ID
 * @param userId (optional) Slack user ID
 * @returns {Promise<string | null>} A valid bot access token, or null if not found
 */
export const getValidAccessToken = async (teamId: string, userId?: string): Promise<string | null> => {
    let installation;

    // Try to find installation with both teamId and userId if userId is provided
    if (userId) {
        installation = await prisma.slackInstallation.findUnique({
            where: {
                teamId_userId: {
                    teamId,
                    userId
                }
            }
        });

        // If we found a specific user installation, use it
        if (installation) {
            console.log(`Found specific installation for team ${teamId} and user ${userId}`);
            const installationData = installation.data as unknown as Installation;

            // If the bot object doesn't exist, we can't get a token.
            if (!installationData.bot) {
                console.error(`Installation for team ${teamId} and user ${userId} is missing bot data.`);
                return null;
            }

            const { expiresAt, refreshToken, token } = installationData.bot;

            if (!expiresAt || !refreshToken || !token) {
                // Cannot refresh without these values, just return the current token
                return token || null;
            }

            // Check if the token is expiring in the next 10 minutes
            const tenMinutesFromNow = Date.now() + 10 * 60 * 1000;
            if (expiresAt * 1000 > tenMinutesFromNow) {
                // Token is not expiring soon, so it's valid
                return token;
            }

            // If it's expiring, refresh it
            return await refreshBotToken(installation.id, installationData, token, refreshToken, expiresAt);
        }
    }

    // Fallback to finding by teamId only if userId not provided or no installation found
    installation = await prisma.slackInstallation.findFirst({
        where: { teamId },
    });

    if (!installation) {
        console.error(`No installation found for team ${teamId}`);
        return null;
    }

    const installationData = installation.data as unknown as Installation;

    // If the bot object doesn't exist, we can't get a token.
    if (!installationData.bot) {
        console.error(`Installation for team ${teamId} is missing bot data.`);
        return null;
    }

    const { expiresAt, refreshToken, token } = installationData.bot;

    if (!expiresAt || !refreshToken || !token) {
        // Cannot refresh without these values, just return the current token
        return token || null;
    }

    // Check if the token is expiring in the next 10 minutes
    const tenMinutesFromNow = Date.now() + 10 * 60 * 1000;
    if (expiresAt * 1000 > tenMinutesFromNow) {
        // Token is not expiring soon, so it's valid
        return token;
    }

    // If it's expiring, refresh it
    return await refreshBotToken(installation.id, installationData, token, refreshToken, expiresAt);
};

/**
 * Helper function to refresh a Slack bot token using the refresh_token grant.
 *
 * - Calls Slack's OAuth v2 access endpoint to refresh the token.
 * - Updates the installation record in the database with new token data.
 * - Returns the new access token, or the old one if refresh fails.
 *
 * @param installationId The database ID of the installation
 * @param installationData The full installation object
 * @param currentToken The current (soon-to-expire) access token
 * @param currentRefreshToken The refresh token
 * @param currentExpiresAt The current expiration timestamp (seconds)
 * @returns {Promise<string | null>} The new access token, or the old one if refresh fails
 */
async function refreshBotToken(
    installationId: string,
    installationData: Installation,
    currentToken: string,
    currentRefreshToken: string,
    currentExpiresAt: number
): Promise<string | null> {
    try {
        const client = new WebClient();
        const refreshResult = await client.oauth.v2.access({
            client_id: process.env.SLACK_CLIENT_ID!,
            client_secret: process.env.SLACK_CLIENT_SECRET!,
            grant_type: 'refresh_token',
            refresh_token: currentRefreshToken,
        });

        // Update the installation data with the new tokens
        const newInstallationData = {
            ...installationData,
            bot: {
                ...installationData.bot,
                token: refreshResult.access_token as string,
                refreshToken: refreshResult.refresh_token as string,
                expiresAt: Date.now() / 1000 + (refreshResult.expires_in as number),
            },
        };

        // Update the record in the database
        await prisma.slackInstallation.update({
            where: { id: installationId },
            data: { data: newInstallationData as any },
        });

        console.log(`Successfully refreshed access token for installation ${installationId}.`);

        // Return the new access token
        return newInstallationData.bot.token;
    } catch (error) {
        console.error(`Error refreshing token for installation ${installationId}:`, error);
        // If refresh fails, return the old token, it might still work for a few minutes
        return currentToken;
    }
}

/**
 * Retrieves a user access token for a given team and user.
 *
 * @param teamId Slack team ID
 * @param userId Slack user ID
 * @returns {Promise<string | null>} The user's access token, or null if not found
 */
export const getUserToken = async (teamId: string, userId: string): Promise<string | null> => {
    const installation = await prisma.slackInstallation.findUnique({
        where: {
            teamId_userId: {
                teamId,
                userId
            }
        }
    });

    if (!installation) {
        console.log(`No installation found for user ${userId} in team ${teamId}`);
        return null;
    }

    const installationData = installation.data as unknown as Installation;
    return installationData.user?.token || null;
};