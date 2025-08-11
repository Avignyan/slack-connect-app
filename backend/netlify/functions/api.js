// Simple serverless function without Express to avoid path-to-regexp errors
const axios = require('axios');
require('dotenv').config();

// Main handler function
exports.handler = async (event, context) => {
    // Debug logging
    console.log(`[${new Date().toISOString()}] Request received:`);
    console.log(`  Path: ${event.path}`);
    console.log(`  Method: ${event.httpMethod}`);
    console.log(`  Query: ${JSON.stringify(event.queryStringParameters || {})}`);

    // Standard CORS headers for all responses
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    };

    // Handle OPTIONS requests (CORS preflight)
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers,
            body: ''
        };
    }

    try {
        // Extract the path from the full URL - removing the Netlify Functions prefix
        const path = event.path.replace('/.netlify/functions/api', '') || '/';

        // Simple router based on path
        if (path === '/' || path === '') {
            // Root path - API status
            return {
                statusCode: 200,
                headers: { ...headers, 'Content-Type': 'text/html' },
                body: '<h1>Slack OAuth API is running</h1><p>Your API is working correctly!</p>'
            };
        }
        else if (path === '/slack/install') {
            // Slack installation flow
            console.log('Handling /slack/install route');

            const clientId = process.env.SLACK_CLIENT_ID;
            // Using the exact redirect URI you've configured in Slack
            const redirectUri = 'https://slack-connect-ap.netlify.app/.netlify/functions/api/auth/slack/callback';
            // Comprehensive scope for Slack permissions
            const scope = 'channels:read,channels:history,chat:write,users:read';

            const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${encodeURIComponent(redirectUri)}`;
            console.log(`Redirecting to Slack: ${slackAuthUrl}`);

            return {
                statusCode: 302,
                headers: {
                    ...headers,
                    'Location': slackAuthUrl
                },
                body: ''
            };
        }
        else if (path === '/auth/slack/callback') {
            // Slack OAuth callback handler
            console.log('Handling /auth/slack/callback route');

            const code = event.queryStringParameters?.code;
            if (!code) {
                console.log('No code provided in callback');
                return {
                    statusCode: 302,
                    headers: {
                        ...headers,
                        'Location': 'https://slack-connect-app-coral.vercel.app?error=no_code'
                    },
                    body: ''
                };
            }

            console.log('Exchanging code for token');

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

            console.log(`Token exchange ${response.data.ok ? 'successful' : 'failed'}`);

            if (!response.data.ok) {
                console.log(`Slack API error: ${response.data.error}`);
                return {
                    statusCode: 302,
                    headers: {
                        ...headers,
                        'Location': `https://slack-connect-app-coral.vercel.app?error=${encodeURIComponent(response.data.error)}`
                    },
                    body: ''
                };
            }

            // Prepare user info for frontend
            const userInfo = {
                userId: response.data.authed_user.id,
                teamId: response.data.team.id,
                teamName: response.data.team.name,
                accessToken: response.data.access_token
            };

            console.log(`Redirecting to frontend with auth success`);

            return {
                statusCode: 302,
                headers: {
                    ...headers,
                    'Location': `https://slack-connect-app-coral.vercel.app?auth=success&userInfo=${encodeURIComponent(JSON.stringify(userInfo))}`
                },
                body: ''
            };
        }
        else if (path === '/channels') {
            // Get channels list
            console.log('Handling /channels route');

            const authHeader = event.headers.authorization || event.headers.Authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return {
                    statusCode: 401,
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'No valid authorization token provided' })
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
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: response.data.error })
                };
            }

            return {
                statusCode: 200,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify(response.data.channels || [])
            };
        }
        else if (path === '/scheduled-messages') {
            // Placeholder for scheduled messages endpoint
            return {
                statusCode: 200,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify([])
            };
        }
        else {
            // Not found
            return {
                statusCode: 404,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Not found' })
            };
        }
    } catch (error) {
        // Comprehensive error logging
        console.error('Error in handler:', error);

        return {
            statusCode: 500,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};