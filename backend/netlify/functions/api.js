const express = require('express');
const serverless = require('serverless-http');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

// Create Express app
const app = express();

// Middleware
app.use(cors());
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
    const scope = 'channels:read,channels:history,chat:write,users:read';

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

        // Redirect to frontend with success
        const frontendUrl = process.env.FRONTEND_URL || 'https://avigyan-slack-scheduler.vercel.app';
        const userInfo = {
            userId: response.data.authed_user.id,
            teamId: response.data.team.id,
            teamName: response.data.team.name
        };

        res.redirect(`${frontendUrl}?auth=success&userInfo=${encodeURIComponent(JSON.stringify(userInfo))}`);
    } catch (error) {
        console.error('Slack OAuth error:', error);
        const frontendUrl = process.env.FRONTEND_URL || 'https://avigyan-slack-scheduler.vercel.app';
        res.redirect(`${frontendUrl}?auth=error&message=${encodeURIComponent(error.message)}`);
    }
});

// Create a wrapper for the Express app with proper path handling
// This is critical - we need to handle paths correctly in the serverless context
const handler = serverless(app, {
    basePath: '/.netlify/functions/api'
});

// Export the serverless handler
exports.handler = async (event, context) => {
    // For debugging
    console.log(`Function invoked with path: ${event.path}`);

    // Return the processed request
    return await handler(event, context);
};