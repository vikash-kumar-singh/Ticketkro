import compression from 'compression'; import cors from 'cors'; import express, { type NextFunction, type Request, type Response } from 'express'; import rateLimit from 'express-rate-limit'; import helmet from 'helmet'; import morgan from 'morgan';
import { env } from './config/env.js'; import { logger } from './config/logger.js'; import { errorHandler, notFound } from './middlewares/index.js'; import { router } from './routes/index.js';
export const app = express();
const rejectMongoOperators = (req: Request, res: Response, next: NextFunction) => {
  const containsUnsafeKey = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return false;
    return Object.entries(value).some(([key, child]) => key.startsWith('$') || key.includes('.') || containsUnsafeKey(child));
  };
  if (containsUnsafeKey(req.body) || containsUnsafeKey(req.query) || containsUnsafeKey(req.params)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Request contains invalid field names' } });
  }
  next();
};
app.set('trust proxy', 1); app.use(helmet()); app.use(cors({ origin: env.FRONTEND_URL.split(',').map(value => new URL(value.trim()).origin), credentials: true })); app.use(compression()); app.use(express.json({ limit: '1mb' })); app.use(express.urlencoded({ extended: true })); app.use(rejectMongoOperators); app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 500, standardHeaders: 'draft-7', legacyHeaders: false })); app.use(morgan('combined', { stream: { write: message => logger.http(message.trim()) } }));
app.get('/', (_req, res) => res.json({ success: true, data: { name: 'Ticket Management System API', status: 'running', version: 'v1', health: '/health', api: '/api/v1' } }));
app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() })); app.use('/api/v1', router); app.use(notFound); app.use(errorHandler);
