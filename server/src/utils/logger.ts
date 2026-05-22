import winston from 'winston';

const { combine, timestamp, json, errors, colorize, simple } = winston.format;

const isProd = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    isProd ? json() : combine(colorize(), simple())
  ),
  transports: [new winston.transports.Console()],
  exitOnError: false,
});

export default logger;
