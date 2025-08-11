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
        'Expires': '0',
        'Content-Type': 'application/json'
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
        console.log(`Cleaned path: "${path}"`);

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
            const scope = 'channels:read,channels:history,chat:write,users:read,users.profile:read,users:read.email,team:read';

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

            try {
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

                // Get user information
                let userName = '';
                try {
                    const userResponse = await axios.get('https://slack.com/api/users.info', {
                        params: {
                            user: response.data.authed_user.id
                        },
                        headers: {
                            Authorization: `Bearer ${response.data.access_token}`
                        }
                    });

                    if (userResponse.data.ok) {
                        userName = userResponse.data.user.real_name || userResponse.data.user.name || '';
                        console.log(`Got user name: ${userName}`);
                    }
                } catch (userError) {
                    console.error('Error fetching user details:', userError.message);
                }

                // Fetch channels during authentication
                console.log('Fetching channels during authentication');
                let channels = [];
                try {
                    const channelsResponse = await axios.get('https://slack.com/api/conversations.list', {
                        params: {
                            types: 'public_channel,private_channel',
                            limit: 1000,
                            exclude_archived: true
                        },
                        headers: {
                            Authorization: `Bearer ${response.data.access_token}`
                        }
                    });

                    if (channelsResponse.data.ok) {
                        channels = channelsResponse.data.channels.map(channel => ({
                            id: channel.id,
                            name: channel.name,
                            is_private: channel.is_private || false,
                            is_member: channel.is_member || false,
                            topic: channel.topic?.value || '',
                            purpose: channel.purpose?.value || ''
                        }));
                        console.log(`Retrieved ${channels.length} channels`);
                    } else {
                        console.log(`Failed to get channels: ${channelsResponse.data.error}`);
                    }
                } catch (err) {
                    console.error('Error fetching channels:', err.message);
                }

                // Prepare user info for frontend
                const userInfo = {
                    userId: response.data.authed_user.id,
                    teamId: response.data.team.id,
                    teamName: response.data.team.name,
                    teamIcon: response.data.team.image_132 || response.data.team.image_230,
                    userName: userName,
                    token: response.data.access_token,
                    accessToken: response.data.access_token, // For backwards compatibility
                    channels: channels, // Include channels in user info
                    // Set token expiry to 12 hours from now
                    expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
                };

                console.log(`Redirecting to frontend with auth success and ${channels.length} channels`);

                return {
                    statusCode: 302,
                    headers: {
                        ...headers,
                        'Location': `https://slack-connect-app-coral.vercel.app?auth=success&userInfo=${encodeURIComponent(JSON.stringify(userInfo))}`
                    },
                    body: ''
                };
            } catch (tokenError) {
                console.error('Error exchanging code for token:', tokenError);
                return {
                    statusCode: 302,
                    headers: {
                        ...headers,
                        'Location': `https://slack-connect-app-coral.vercel.app?error=${encodeURIComponent('Failed to exchange code for token: ' + tokenError.message)}`
                    },
                    body: ''
                };
            }
        }
        // Handle both /channels and /api/channels (the duplicate path)
        else if (path === '/channels' || path === '/api/channels') {
            // Get channels list
            console.log('Handling channels request');

            const authHeader = event.headers.authorization || event.headers.Authorization;
            console.log('Auth header present:', !!authHeader);

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ error: 'No valid authorization token provided' })
                };
            }

            const token = authHeader.split(' ')[1];
            console.log('Token (first 10 chars):', token.substring(0, 10) + '...');

            console.log('Sending request to Slack API');
            try {
                const response = await axios.get('https://slack.com/api/conversations.list', {
                    params: {
                        types: 'public_channel,private_channel',
                        limit: 1000, // Get more channels
                        exclude_archived: true
                    },
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                console.log('Slack API response:',
                    response.data.ok ? `Success (${response.data.channels?.length || 0} channels)` : `Error: ${response.data.error}`);

                if (!response.data.ok) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({
                            error: response.data.error,
                            details: 'Failed to fetch channels from Slack API'
                        })
                    };
                }

                // Process channels to ensure correct format
                const channels = response.data.channels.map(channel => ({
                    id: channel.id,
                    name: channel.name,
                    is_private: channel.is_private || false,
                    is_member: channel.is_member || false,
                    topic: channel.topic?.value || '',
                    purpose: channel.purpose?.value || ''
                }));

                console.log(`Returning ${channels.length} channels`);
                if (channels.length > 0) {
                    console.log('First channel example:', JSON.stringify(channels[0]));
                }

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(channels)
                };
            } catch (error) {
                console.error('Error fetching channels:', error.message);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({
                        error: 'Error fetching channels',
                        message: error.message
                    })
                };
            }
        }
        // Handle both /scheduled-messages and /api/scheduled-messages
        else if (path === '/scheduled-messages' || path === '/api/scheduled-messages' ||
            path === '/api/sch-messages' || path === '/sch-messages') {
            // Placeholder for scheduled messages endpoint
            console.log('Handling scheduled-messages route');

            const authHeader = event.headers.authorization || event.headers.Authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ error: 'No valid authorization token provided' })
                };
            }

            // For now, just return an empty array - implement proper storage later
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify([])
            };
        }
        // Handle logout
        else if (path === '/logout' || path === '/api/logout') {
            console.log('Handling logout request');
            // For now, just return success (client-side logout is sufficient)
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, message: 'Logged out successfully' })
            };
        }
        else {
            // Not found - log the path that wasn't matched
            console.log(`No route matched for path: ${path}`);
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Not found', path })
            };
        }
    } catch (error) {
        // Comprehensive error logging
        console.error('Error in handler:', error);

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};