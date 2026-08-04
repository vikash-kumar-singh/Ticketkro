import winston from 'winston';
import { env } from './env.js';

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console({ format: env.NODE_ENV === 'development' ? winston.format.combine(winston.format.colorize(), winston.format.simple()) : undefined })],
});
