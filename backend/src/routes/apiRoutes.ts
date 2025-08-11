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
router.post('/login', login);

// Protected routes
router.get('/channels', authenticate, getChannels);
router.post('/send-message', authenticate, sendMessage);
router.post('/schedule-message', authenticate, scheduleMessage);
router.get('/scheduled-messages', authenticate, getScheduledMessages);
router.delete('/scheduled-messages/:id', authenticate, cancelScheduledMessage);
router.post('/logout', authenticate, logout);

export default router;