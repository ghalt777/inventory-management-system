import express, { Application } from 'express';
import morgan from 'morgan';
import { Database } from './config/database';
import { config } from './config/env';
import { logger, morganStream } from './config/logger';
import { errorHandler } from './middleware/errorHandler';
import productsRouter from './routes/products';
import ordersRouter from './routes/orders';

const app: Application = express();

// HTTP request logging
const morganFormat = config.nodeEnv === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, { stream: morganStream }));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/products', productsRouter);
app.use('/orders', ordersRouter);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Connect to database
    const db = Database.getInstance();
    await db.connect(config.mongodbUri);

    // Start listening
    app.listen(config.port, () => {
      logger.info(`Server is running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  const db = Database.getInstance();
  await db.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  const db = Database.getInstance();
  await db.disconnect();
  process.exit(0);
});

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

export { app, startServer };

