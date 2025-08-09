import { Router } from 'express';
import {
    getChannels,
    sendMessage,
    scheduleMessage,
    getScheduledMessages,
    cancelScheduledMessage,
} from '../controllers/slackController.js';

import { /*...,*/ logout } from '../controllers/slackController.js';
const router = Router();

router.get('/channels', getChannels);
router.post('/send-message', sendMessage);
router.post('/schedule-message', scheduleMessage);
router.get('/scheduled-messages', getScheduledMessages);
router.delete('/scheduled-messages/:id', cancelScheduledMessage);
router.post('/logout', logout);

export default router;