import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from './env';

const isDevelopment = config.nodeEnv === 'development';

const productionFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

const transports: winston.transport[] = [
  // Console transport for all environments
  new winston.transports.Console({
    format: isDevelopment ? developmentFormat : productionFormat,
  }),
];

if (!isDevelopment) {
  // Error logs - separate file for errors only
  transports.push(
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '30d',
      maxSize: '20m',
      format: productionFormat,
    })
  );

  // Combined logs - all logs
  transports.push(
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      maxSize: '20m',
      format: productionFormat,
    })
  );
}

const logger = winston.createLogger({
  level: isDevelopment ? 'debug' : 'error',
  transports,
  exitOnError: false, // Don't exit on handled errors
});

export const morganStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export { logger };

