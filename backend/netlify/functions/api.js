const axios = require('axios');

// Simple path router for serverless functions
const router = {
    '/': handleRoot,
    '/slack/install': handleSlackInstall,
    '/auth/slack/callback': handleSlackCallback,
    '/channels': handleChannels,
    '/scheduled-messages': handleScheduledMessages,
    '/logout': handleLogout
};

// Main handler function
exports.handler = async (event, context) => {
    console.log(`Request path: ${event.path}`);
    console.log(`Request method: ${event.httpMethod}`);

    // Extract path from the full path (removing /.netlify/functions/api)
    const path = event.path.replace('/.netlify/functions/api', '') || '/';

    // Find handler for this path
    const handler = router[path];

    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: getCorsHeaders(),
            body: ''
        };
    }

    // Execute handler if found, otherwise return 404
    if (handler) {
        try {
            return await handler(event, context);
        } catch (error) {
            console.error(`Error handling ${path}:`, error);
            return {
                statusCode: 500,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: error.message })
            };
        }
    } else {
        return {
            statusCode: 404,
            headers: getCorsHeaders(),
            body: JSON.stringify({ error: 'Not found' })
        };
    }
};

// Root endpoint handler
async function handleRoot(event) {
    return {
        statusCode: 200,
        headers: getCorsHeaders(),
        body: 'Slack OAuth API is running'
    };
}

// Slack install handler
async function handleSlackInstall(event) {
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = 'https://slack-connect-ap.netlify.app/.netlify/functions/api/auth/slack/callback';
    const scope = 'channels:read,channels:history,chat:write,users:read,users.profile:read,users:read.email,team:read';

    const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${encodeURIComponent(redirectUri)}`;

    return {
        statusCode: 302,
        headers: {
            ...getCorsHeaders(),
            Location: slackAuthUrl
        },
        body: ''
    };
}

// Slack callback handler
async function handleSlackCallback(event) {
    try {
        const code = event.queryStringParameters?.code;
        if (!code) {
            return redirectToFrontend({ auth: 'error', message: 'No code provided' });
        }

        // Exchange code for token
        const clientId = process.env.SLACK_CLIENT_ID;
        const clientSecret = process.env.SLACK_CLIENT_SECRET;
        const redirectUri = 'https://slack-connect-ap.netlify.app/.netlify/functions/api/auth/slack/callback';

        const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
            params: {
                client_id: clientId,
                client_secret: clientSecret,
                code: code,
                redirect_uri: redirectUri
            }
        });

        if (!response.data.ok) {
            return redirectToFrontend({ auth: 'error', message: response.data.error });
        }

        // Get user details
        const userResponse = await axios.get('https://slack.com/api/users.info', {
            params: {
                user: response.data.authed_user.id
            },
            headers: {
                Authorization: `Bearer ${response.data.access_token}`
            }
        });

        // Get channels list
        const channelsResponse = await axios.get('https://slack.com/api/conversations.list', {
            params: {
                types: 'public_channel,private_channel'
            },
            headers: {
                Authorization: `Bearer ${response.data.access_token}`
            }
        });

        // Prepare complete user data
        const userData = {
            userId: response.data.authed_user.id,
            teamId: response.data.team.id,
            teamName: response.data.team.name,
            accessToken: response.data.access_token,
            userName: userResponse.data.user ? userResponse.data.user.name : 'Unknown',
            realName: userResponse.data.user ? userResponse.data.user.real_name : 'Unknown',
            channels: channelsResponse.data.ok ? channelsResponse.data.channels : []
        };

        return redirectToFrontend({
            auth: 'success',
            userData: JSON.stringify(userData)
        });
    } catch (error) {
        console.error('Slack OAuth error:', error);
        return redirectToFrontend({
            auth: 'error',
            message: error.message
        });
    }
}

// Channels handler
async function handleChannels(event) {
    try {
        const authHeader = getAuthHeader(event);
        if (!authHeader) {
            return {
                statusCode: 401,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: 'No authorization token provided' })
            };
        }

        const token = authHeader.split(' ')[1];
        const response = await axios.get('https://slack.com/api/conversations.list', {
            params: {
                types: 'public_channel,private_channel'
            },
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!response.data.ok) {
            return {
                statusCode: 400,
                headers: getCorsHeaders(),
                body: JSON.stringify({ error: response.data.error })
            };
        }

        return {
            statusCode: 200,
            headers: getCorsHeaders(),
            body: JSON.stringify(response.data.channels)
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: getCorsHeaders(),
            body: JSON.stringify({ error: error.message })
        };
    }
}

// Scheduled messages handler
async function handleScheduledMessages(event) {
    return {
        statusCode: 200,
        headers: getCorsHeaders(),
        body: JSON.stringify([])
    };
}

// Logout handler
async function handleLogout(event) {
    return {
        statusCode: 200,
        headers: getCorsHeaders(),
        body: JSON.stringify({ success: true })
    };
}

// Helper function to create a frontend redirect
function redirectToFrontend(params) {
    const frontendUrl = 'https://slack-connect-app-coral.vercel.app';
    const queryString = Object.keys(params)
        .map(key => `${key}=${encodeURIComponent(params[key])}`)
        .join('&');

    return {
        statusCode: 302,
        headers: {
            ...getCorsHeaders(),
            Location: `${frontendUrl}?${queryString}`
        },
        body: ''
    };
}

// Helper to get Authorization header
function getAuthHeader(event) {
    return event.headers.authorization || event.headers.Authorization;
}

// Helper to create CORS headers
function getCorsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    };
}