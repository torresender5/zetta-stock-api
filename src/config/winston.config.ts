import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
// import 'winston-daily-rotate-file'; // For daily file rotation

export const winstonConfig: WinstonModuleOptions = {
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [${level}]: ${message}`;
        }),
      ),
    }),
    new winston.transports.File({
      filename: process.env.LOG_FILE,
      zippedArchive: true,
      maxsize: 5000000,
      maxFiles: 30,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [${level}]: ${message}`;
        }),
      ),
    }),
  ],
};
