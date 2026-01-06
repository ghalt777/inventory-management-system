import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Request context for logging
  const requestContext = {
    method: req.method,
    path: req.path,
    ip: req.ip,
  };

  if (err instanceof AppError) {
    // 4xx = client errors (operational) -> warn
    // 5xx = server errors (unexpected) -> error
    const logLevel = err.statusCode >= 500 ? 'error' : 'warn';
    
    logger[logLevel]('Operational error', {
      ...requestContext,
      statusCode: err.statusCode,
      message: err.message,
    });

    return res.status(err.statusCode).json({
      error: err.message,
      statusCode: err.statusCode,
    });
  }

  // Handle Mongoose validation errors (400 - client error)
  if (err.name === 'ValidationError') {
    logger.warn('Validation error', {
      ...requestContext,
      error: err.message,
    });

    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
    });
  }

  // Handle Mongoose CastError (400 - client error, invalid input)
  if (err.name === 'CastError') {
    logger.warn('Cast error (invalid ID)', {
      ...requestContext,
      error: err.message,
    });

    return res.status(400).json({
      error: 'Invalid ID format',
      message: 'The provided ID is not valid',
    });
  }

  // Log unexpected errors with full stack trace (500 - server error)
  logger.error('Unexpected error', {
    ...requestContext,
    error: err.message,
    stack: err.stack,
  });

  // Generic error response
  return res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

