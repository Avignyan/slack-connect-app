const serverless = require('serverless-http');
const { app } = require('../../dist/index.js');

// Create a wrapper for the Express app
const handler = serverless(app);

// Export the serverless handler
exports.handler = async (event, context) => {
    // Return the processed request
    return await handler(event, context);
};