const express = require('express');
const serverless = require('serverless-http');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

// Create Express app
const app = express();

// Enhanced CORS configuration
app.use(cors({
    origin: ['https://slack-connect-app-coral.vercel.app', 'https://avigyan-slack-scheduler.vercel.app', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests explicitly
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Detailed logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
});

// Root endpoint for testing
app.get('/', (req, res) => {
    res.send('Slack OAuth API is running');
});

// Add to Slack button redirect
app.get('/slack/install', (req, res) => {
    console.log('[INSTALL] Slack install route hit');
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = 'https://slack-connect-ap.netlify.app/.netlify/functions/api/auth/slack/callback';
    const scope = 'channels:read,channels:history,chat:write,users:read';

    const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    console.log(`[INSTALL] Redirecting to: ${slackAuthUrl}`);

    // Add cache control headers to prevent redirect loops
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.redirect(slackAuthUrl);
});

// The critical callback route
app.get('/auth/slack/callback', async (req, res) => {
    console.log('[CALLBACK] Route hit with code:', req.query.code ? 'Present' : 'Missing');
    try {
        const code = req.query.code;
        if (!code) {
            console.log('[CALLBACK] No code provided');
            return res.redirect('https://slack-connect-app-coral.vercel.app?error=no_code');
        }

        // Exchange code for token
        const clientId = process.env.SLACK_CLIENT_ID;
        const clientSecret = process.env.SLACK_CLIENT_SECRET;
        const redirectUri = 'https://slack-connect-ap.netlify.app/.netlify/functions/api/auth/slack/callback';

        console.log('[CALLBACK] Exchanging code for token');
        const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
            params: {
                client_id: clientId,
                client_secret: clientSecret,
                code: code,
                redirect_uri: redirectUri
            }
        });

        console.log('[CALLBACK] Token exchange response:',
            response.data.ok ? 'Success' : `Error: ${response.data.error}`);

        if (!response.data.ok) {
            return res.redirect(`https://slack-connect-app-coral.vercel.app?error=${response.data.error}`);
        }

        // Prepare user info
        const userInfo = {
            userId: response.data.authed_user.id,
            teamId: response.data.team.id,
            teamName: response.data.team.name,
            accessToken: response.data.access_token
        };

        console.log('[CALLBACK] Redirecting to frontend with success');

        // Add cache control headers to prevent redirect loops
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        return res.redirect(`https://slack-connect-app-coral.vercel.app?auth=success&userInfo=${encodeURIComponent(JSON.stringify(userInfo))}`);
    } catch (error) {
        console.error('[CALLBACK] OAuth error:', error);
        return res.redirect(`https://slack-connect-app-coral.vercel.app?error=${encodeURIComponent(error.message)}`);
    }
});

// Channels API endpoint
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

        return res.json(response.data.channels || []);
    } catch (error) {
        console.error('Error fetching channels:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Simple scheduled messages endpoint
app.get('/scheduled-messages', (req, res) => {
    res.json([]);
});

// Simple logout endpoint
app.post('/logout', (req, res) => {
    res.json({ success: true });
});

// CRITICAL: Create serverless handler with correct basePath
const handler = serverless(app, {
    basePath: '/.netlify/functions/api'
});

// Export the handler with comprehensive logging
exports.handler = async (event, context) => {
    // Detailed request logging
    console.log('-----------------------------');
    console.log(`FUNCTION INVOKED: ${new Date().toISOString()}`);
    console.log(`PATH: ${event.path}`);
    console.log(`METHOD: ${event.httpMethod}`);
    console.log(`QUERY: ${JSON.stringify(event.queryStringParameters)}`);
    console.log(`HEADERS: ${JSON.stringify(event.headers)}`);
    console.log('-----------------------------');

    try {
        // Handle the request
        const result = await handler(event, context);
        return result;
    } catch (error) {
        console.error('SERVERLESS HANDLER ERROR:', error);

        // Return a meaningful error response
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify({ error: 'Internal server error', message: error.message })
        };
    }
};