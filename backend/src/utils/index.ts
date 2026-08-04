import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export class AppError extends Error { constructor(public statusCode: number, message: string, public code = 'ERROR') { super(message); } }
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => void fn(req, res, next).catch(next);
export const ok = (res: Response, data: unknown, message?: string, meta?: unknown, status = 200) => res.status(status).json({ success: true, data, ...(message ? { message } : {}), ...(meta ? { meta } : {}) });
export const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
export const randomToken = () => crypto.randomBytes(32).toString('hex');
export const ticketNumber = () => `TKT-${Date.now().toString(36).toUpperCase()}-${crypto.randomInt(1000, 9999)}`;
