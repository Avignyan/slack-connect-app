const express = require('express');
const serverless = require('serverless-http');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

// Create Express app
const app = express();

// Improve CORS handling - allow requests from your Vercel domain
app.use(cors({
    origin: ['https://slack-connect-app-coral.vercel.app', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight OPTIONS requests explicitly
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root endpoint for testing
app.get('/', (req, res) => {
    res.send('Slack OAuth API is running');
});

// IMPLEMENT CHANNELS ENDPOINT
app.get('/channels', async (req, res) => {
    try {
        // If token is passed in Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'No authorization token provided' });
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

// IMPLEMENT SCHEDULED MESSAGES ENDPOINT
app.get('/scheduled-messages', (req, res) => {
    // Mock response for now
    res.json([]);
});

// ADD LOGOUT ENDPOINT
app.post('/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
});

// Slack OAuth Routes (keep these from previous code)
app.get('/slack/install', (req, res) => {
    // Your existing code
});

app.get('/auth/slack/callback', async (req, res) => {
    // Your existing code
});

// Create a wrapper for the Express app with proper path handling
const handler = serverless(app, {
    basePath: '/.netlify/functions/api'
});

// Export the serverless handler
exports.handler = async (event, context) => {
    return await handler(event, context);
};