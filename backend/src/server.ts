import { app } from './app.js'; import { env } from './config/env.js'; import { logger } from './config/logger.js'; import { mongoose } from './models/index.js';
await mongoose.connect(env.MONGODB_URI, { maxPoolSize: 20, minPoolSize: 2, serverSelectionTimeoutMS: 10000 }); logger.info('MongoDB connected');
const server = app.listen(env.PORT, () => logger.info(`API listening on ${env.PORT}`));
const shutdown = (signal: string) => { logger.info(`${signal}: graceful shutdown`); server.close(async () => { await mongoose.disconnect(); process.exit(0); }); setTimeout(() => process.exit(1), 10000).unref(); };
process.on('SIGTERM', () => shutdown('SIGTERM')); process.on('SIGINT', () => shutdown('SIGINT')); process.on('unhandledRejection', error => { logger.error(error); shutdown('unhandledRejection'); });
