const express = require('express');
const serverless = require('serverless-http');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

// Create Express app
const app = express();

// CORS configuration - specify allowed origins
app.use(cors({
    origin: ['https://slack-connect-app-coral.vercel.app', 'https://avigyan-slack-scheduler.vercel.app', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Handle OPTIONS requests explicitly for CORS preflight
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debugging middleware to log all requests
app.use((req, res, next) => {
    console.log(`Request received: ${req.method} ${req.originalUrl}`);
    next();
});

// Root endpoint for testing
app.get('/', (req, res) => {
    res.send('Slack OAuth API is running');
});

// Add to Slack button redirect
app.get('/slack/install', (req, res) => {
    console.log('Slack install route hit');
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = 'https://slack-connect-ap.netlify.app/.netlify/functions/api/auth/slack/callback';
    // Expanded scope to include more permissions
    const scope = 'channels:read,channels:history,chat:write,users:read,users.profile:read,users:read.email,team:read';

    const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    console.log(`Redirecting to: ${slackAuthUrl}`);
    res.redirect(slackAuthUrl);
});

// The critical callback route
app.get('/auth/slack/callback', async (req, res) => {
    console.log('Callback route hit with code:', req.query.code);
    try {
        const code = req.query.code;
        if (!code) {
            throw new Error('No code provided');
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
            throw new Error(`Slack error: ${response.data.error}`);
        }

        // Get user details from Slack API
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

        // Update frontend URL to match your latest deployment
        const frontendUrl = 'https://slack-connect-app-coral.vercel.app';
        res.redirect(`${frontendUrl}?auth=success&userData=${encodeURIComponent(JSON.stringify(userData))}`);
    } catch (error) {
        console.error('Slack OAuth error:', error);
        // Update frontend URL to match your latest deployment
        const frontendUrl = 'https://slack-connect-app-coral.vercel.app';
        res.redirect(`${frontendUrl}?auth=error&message=${encodeURIComponent(error.message)}`);
    }
});

// Add API endpoints for the frontend to use
app.get('/channels', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No valid authorization token provided' });
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
            return res.status(400).json({ error: response.data.error });
        }

        return res.json(response.data.channels);
    } catch (error) {
        console.error('Error fetching channels:', error);
        return res.status(500).json({ error: error.message });
    }
});

app.get('/scheduled-messages', (req, res) => {
    // For now, return empty array - implement actual logic later
    res.json([]);
});

app.post('/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
});

// Create a wrapper for the Express app with proper path handling
const handler = serverless(app, {
    basePath: '/.netlify/functions/api'
});

// Export the serverless handler
exports.handler = async (event, context) => {
    // For debugging
    console.log(`Function invoked with path: ${event.path}`);
    console.log(`Query parameters: ${JSON.stringify(event.queryStringParameters)}`);

    // Return the processed request
    return await handler(event, context);
};