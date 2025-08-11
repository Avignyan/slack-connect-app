const express = require('express');
const serverless = require('serverless-http');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

// Create Express app
const app = express();

// Basic CORS setup - avoid complex options that might cause parsing issues
app.use(cors());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root endpoint for testing
app.get('/', (req, res) => {
    res.send('Slack OAuth API is running');
});

// Simple channels endpoint
app.get('/channels', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        const token = authHeader.split(' ')[1];
        const response = await axios.get('https://slack.com/api/conversations.list', {
            params: { types: 'public_channel,private_channel' },
            headers: { Authorization: `Bearer ${token}` }
        });

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

// Add logout endpoint
app.post('/logout', (req, res) => {
    res.json({ success: true });
});

// Slack OAuth flow - simplified install endpoint
app.get('/slack/install', (req, res) => {
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = 'https://slack-connect-ap.netlify.app/.netlify/functions/api/auth/slack/callback';
    const scope = 'channels:read,channels:history,chat:write,users:read';

    const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    res.redirect(slackAuthUrl);
});

// Simplified callback endpoint
app.get('/auth/slack/callback', async (req, res) => {
    try {
        const code = req.query.code;
        if (!code) {
            return res.redirect('https://slack-connect-app-coral.vercel.app?error=no_code');
        }

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
            return res.redirect(`https://slack-connect-app-coral.vercel.app?error=${response.data.error}`);
        }

        // Successfully authenticated
        return res.redirect(`https://slack-connect-app-coral.vercel.app?token=${response.data.access_token}&team=${response.data.team.name}`);
    } catch (error) {
        console.error('OAuth error:', error);
        return res.redirect(`https://slack-connect-app-coral.vercel.app?error=server_error`);
    }
});

// Simplified serverless handler
const handler = serverless(app);

exports.handler = async (event, context) => {
    return await handler(event, context);
};