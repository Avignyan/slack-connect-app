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

// Root endpoint for testing
app.get('/', (req, res) => {
    res.send('Slack OAuth API is running');
});

// Initial Slack OAuth redirect
app.get('/auth/slack', (req, res) => {
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = `${process.env.NETLIFY_URL || 'https://slack-connect-ap.netlify.app'}/.netlify/functions/api/auth/slack/callback`;
    const scope = 'channels:read,channels:history,chat:write,users:read'; // Adjust scopes as needed

    const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${redirectUri}`;
    res.redirect(slackAuthUrl);
});

// Slack OAuth callback - THIS IS THE MISSING ROUTE
app.get('/auth/slack/callback', async (req, res) => {
    try {
        const code = req.query.code;
        if (!code) {
            throw new Error('No code provided');
        }

        // Exchange code for token
        const clientId = process.env.SLACK_CLIENT_ID;
        const clientSecret = process.env.SLACK_CLIENT_SECRET;
        const redirectUri = `${process.env.NETLIFY_URL || 'https://slack-connect-ap.netlify.app'}/.netlify/functions/api/auth/slack/callback`;

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

        // Get user info with the token
        const userResponse = await axios.get('https://slack.com/api/users.identity', {
            headers: {
                Authorization: `Bearer ${response.data.authed_user.access_token}`
            }
        });

        // Store token in database or session (implement this)
        // ...

        // Redirect to frontend with success
        const frontendUrl = process.env.FRONTEND_URL || 'https://your-frontend-url.com';
        const userInfo = {
            userId: response.data.authed_user.id,
            teamId: response.data.team.id,
            teamName: response.data.team.name
        };

        res.redirect(`${frontendUrl}?auth=success&userInfo=${encodeURIComponent(JSON.stringify(userInfo))}`);
    } catch (error) {
        console.error('Slack OAuth error:', error);
        const frontendUrl = process.env.FRONTEND_URL || 'https://your-frontend-url.com';
        res.redirect(`${frontendUrl}?auth=error&message=${encodeURIComponent(error.message)}`);
    }
});

// Verification endpoint for Slack Events API
app.post('/slack/events', (req, res) => {
    // Implement Slack events handling here
    res.status(200).send();
});

// Create a wrapper for the Express app
const handler = serverless(app);

// Export the serverless handler
exports.handler = async (event, context) => {
    // Return the processed request
    return await handler(event, context);
};