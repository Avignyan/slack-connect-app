import { Request, Response, NextFunction } from 'express';
import * as sessionRepo from '../repositories/installationRepository.js';

// Extend the Express Request type to include user info
declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: string;
                teamId: string;
            };
        }
    }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    // Get the session token from the Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization header missing or invalid' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Get the session from the token
        const session = await sessionRepo.getSessionByToken(token);

        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }

        // Check if session is expired
        if (new Date() > session.expiresAt) {
            await sessionRepo.deleteSession(token);
            return res.status(401).json({ error: 'Session expired' });
        }

        // Attach user info to the request
        req.user = {
            userId: session.userId,
            teamId: session.teamId
        };

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
};