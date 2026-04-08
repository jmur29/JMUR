'use strict';

const { createLogger, format, transports } = require('winston');

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const logger = createLogger({
  level: LOG_LEVEL,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.printf(({ timestamp, level, message, stack }) => {
      const prefix = `[${timestamp}] [${level.toUpperCase().padEnd(5)}]`;
      return stack ? `${prefix} ${message}\n${stack}` : `${prefix} ${message}`;
    })
  ),
  transports: [new transports.Console()],
});

module.exports = logger;
