/**
 * API Routes for Slack Connect Backend
 *
 * This file defines all REST API endpoints for the backend, including authentication, channel management,
 * message sending, scheduling, and session/logout. Each route is documented with its HTTP method, path,
 * authentication requirements, and the controller it invokes.
 *
 * Public Routes:
 *   - POST /login: Log in with user and team ID to receive a session token.
 *
 * Protected Routes (require authentication):
 *   - GET /channels: List Slack channels the user is a member of.
 *   - POST /send-message: Send a message to a Slack channel.
 *   - POST /schedule-message: Schedule a message for later delivery.
 *   - GET /scheduled-messages: List all scheduled messages for the user.
 *   - DELETE /scheduled-messages/:id: Cancel a scheduled message by ID.
 *   - POST /logout: Log out and invalidate the session.
 *
 * Middleware:
 *   - authenticate: Ensures the user is authenticated via session token.
 */

import { Router } from 'express';
import {
    login,
    getChannels,
    sendMessage,
    scheduleMessage,
    getScheduledMessages,
    cancelScheduledMessage,
    logout,
} from '../controllers/slackController.js';

import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// Public routes
/**
 * POST /login
 *
 * Log in with user and team ID to receive a session token.
 * Controller: login
 * Public route (no authentication required).
 */
router.post('/login', login);

// Protected routes
/**
 * GET /channels
 *
 * List Slack channels the user is a member of.
 * Controller: getChannels
 * Requires authentication.
 */
router.get('/channels', authenticate, getChannels);
/**
 * POST /send-message
 *
 * Send a message to a Slack channel.
 * Controller: sendMessage
 * Requires authentication.
 */
router.post('/send-message', authenticate, sendMessage);
/**
 * POST /schedule-message
 *
 * Schedule a message for later delivery.
 * Controller: scheduleMessage
 * Requires authentication.
 */
router.post('/schedule-message', authenticate, scheduleMessage);
/**
 * GET /scheduled-messages
 *
 * List all scheduled messages for the user.
 * Controller: getScheduledMessages
 * Requires authentication.
 */
router.get('/scheduled-messages', authenticate, getScheduledMessages);
/**
 * DELETE /scheduled-messages/:id
 *
 * Cancel a scheduled message by ID.
 * Controller: cancelScheduledMessage
 * Requires authentication.
 */
router.delete('/scheduled-messages/:id', authenticate, cancelScheduledMessage);
/**
 * POST /logout
 *
 * Log out and invalidate the session.
 * Controller: logout
 * Requires authentication.
 */
router.post('/logout', authenticate, logout);

// New workspace management routes
//router.get('/workspaces', authenticate, getWorkspaces);
//router.post('/workspaces/switch', authenticate, switchWorkspace);

export default router;