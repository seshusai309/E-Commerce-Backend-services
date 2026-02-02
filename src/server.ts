// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { logger } from './utils/logger';
import connectDB from './config/db';
import userRoutes from './users/routes/userRoutes';
import productRoutes from './products/routes/productRoutes';
import cartRoutes from './products/routes/cartRoutes';
import wishlistRoutes from './products/routes/wishlistRoutes';
import orderRoutes from './products/routes/orderRoutes';
import cors from 'cors';
import cookieParser from 'cookie-parser';

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to database
connectDB();

// CORS middleware
app.use(
  cors({
    origin: true,
    credentials: true, // Allow cookies to be sent with requests
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Cookie',
    ],
    exposedHeaders: ['Set-Cookie'],
  })
);

// Cookie parser middleware
app.use(cookieParser());

// Middleware
app.use(express.json());

// Routes
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/orders', orderRoutes);

app.get('/', (req, res) => {
  logger.success('anonymous', 'rootRoute', 'Root endpoint accessed successfully');
  
  res.json({ message: 'E-commerce Inventory Backend API' });
});

const server = app.listen(PORT, () => {
  logger.success('system', 'serverStart', `Server started successfully on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: any) => {
  logger.error('system', 'unhandledRejection', `Unhandled Rejection! Shutting down... ${err.message}`);
  server.close(() => {
    logger.success('system', 'unhandledRejection', 'Server closed after unhandled rejection');
    process.exit(1);
  });
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  logger.success('system', 'SIGTERM', 'SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    logger.success('system', 'SIGTERM', 'Process terminated!');
    process.exit(0);
  });
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  logger.success('system', 'SIGINT', 'SIGINT RECEIVED. Shutting down gracefully');
  server.close(() => {
    logger.success('system', 'SIGINT', 'Process terminated!');
    process.exit(0);
  });
});
