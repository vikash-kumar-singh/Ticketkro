import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import type { Role } from '../constants/index.js';
import { AppError } from '../utils/index.js';

export const authenticate = (req: Request, _res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined;
  if (!token) return next(new AppError(401, 'Authentication required', 'UNAUTHORIZED'));
  try { req.user = jwt.verify(token, env.JWT_ACCESS_SECRET) as Request['user']; return next(); }
  catch { return next(new AppError(401, 'Invalid or expired access token', 'INVALID_TOKEN')); }
};
export const authorize = (...roles: Role[]) => (req: Request, _res: Response, next: NextFunction) => req.user && roles.includes(req.user.role) ? next() : next(new AppError(403, 'Insufficient permissions', 'FORBIDDEN'));
export const notFound = (req: Request, _res: Response, next: NextFunction) => next(new AppError(404, `Route ${req.method} ${req.path} not found`, 'NOT_FOUND'));
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const status = error instanceof AppError ? error.statusCode : 500;
  if (status >= 500) logger.error(error);
  res.status(status).json({ success: false, error: { code: error.code ?? 'INTERNAL_ERROR', message: status === 500 && env.NODE_ENV === 'production' ? 'Internal server error' : error.message, ...(env.NODE_ENV === 'development' && { stack: error.stack }) } });
};
