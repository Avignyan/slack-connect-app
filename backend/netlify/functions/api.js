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

// Debug logging for all requests
app.use((req, res, next) => {
    console.log(`REQUEST: ${req.method} ${req.path}`);
    next();
});

// Root endpoint
app.get('/', (req, res) => {
    res.send('Slack OAuth API is running');
});

// Slack installation endpoint
app.get('/slack/install', (req, res) => {
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = 'https://slack-connect-ap.netlify.app/.netlify/functions/api/auth/slack/callback';
    const scope = 'channels:read,channels:history,chat:write,users:read';

    const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    console.log(`Redirecting to Slack: ${slackAuthUrl}`);
    res.redirect(slackAuthUrl);
});

// The callback route
app.get('/auth/slack/callback', async (req, res) => {
    console.log('CALLBACK RECEIVED!', req.query);
    try {
        const code = req.query.code;
        if (!code) {
            return res.redirect('https://slack-connect-app-coral.vercel.app?error=no_code');
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

        console.log('Token exchange response:', response.data);

        if (!response.data.ok) {
            return res.redirect(`https://slack-connect-app-coral.vercel.app?error=${response.data.error}`);
        }

        // Success! Redirect back to frontend with token
        return res.redirect(`https://slack-connect-app-coral.vercel.app?token=${response.data.access_token}&team=${response.data.team.name}`);
    } catch (error) {
        console.error('OAuth error:', error);
        return res.redirect(`https://slack-connect-app-coral.vercel.app?error=${encodeURIComponent(error.message)}`);
    }
});

// Additional API endpoints
app.get('/channels', async (req, res) => {
    res.json([]); // Implement real logic later
});

app.get('/scheduled-messages', (req, res) => {
    res.json([]); // Implement real logic later
});

// Create serverless handler
const handler = serverless(app);

// Export the handler with extra logging
exports.handler = async (event, context) => {
    // Log incoming request details for debugging
    console.log('INCOMING REQUEST:');
    console.log('  Path:', event.path);
    console.log('  Method:', event.httpMethod);
    console.log('  Query:', JSON.stringify(event.queryStringParameters));

    return await handler(event, context);
};