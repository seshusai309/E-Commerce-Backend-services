import { Request, Response, NextFunction } from 'express';
import { OrderRepository } from '../repository/OrderRepository';
import { CartRepository } from '../repository/CartRepository';
import { ProductRepository } from '../repository/ProductRepository';
import { UserRepository } from '../../users/repository/UserRepository';
import { StripeService } from '../services/StripeService';
import { logger } from '../../utils/logger';

export class OrderController {
  private orderRepository: OrderRepository;
  private cartRepository: CartRepository;
  private productRepository: ProductRepository;
  private userRepository: UserRepository;
  private stripeService: StripeService;

  constructor() {
    this.orderRepository = new OrderRepository();
    this.cartRepository = new CartRepository();
    this.productRepository = new ProductRepository();
    this.userRepository = new UserRepository();
    this.stripeService = new StripeService();
  }

  // Create order from cart
  async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
        return;
      }

      const { shippingAddress, paymentMethod, successUrl, cancelUrl } = req.body;

      if (!shippingAddress || !paymentMethod) {
        res.status(400).json({
          success: false,
          message: 'Shipping address and payment method are required'
        });
        return;
      }

      // Validate payment method
      if (!['ONLINE', 'COD'].includes(paymentMethod)) {
        res.status(400).json({
          success: false,
          message: 'Invalid payment method. Must be ONLINE or COD'
        });
        return;
      }

      // For ONLINE payment, require success and cancel URLs
      if (paymentMethod === 'ONLINE' && (!successUrl || !cancelUrl)) {
        res.status(400).json({
          success: false,
          message: 'Success URL and cancel URL are required for online payment'
        });
        return;
      }

      // Get user's cart
      const cart = await this.cartRepository.findByUserId(userId);
      if (!cart || cart.items.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Cart is empty. Add items to cart before placing order'
        });
        return;
      }

      // Validate products and get current prices
      const orderItems = [];
      let totalAmount = 0;
      let totalItems = 0;

      for (const cartItem of cart.items) {
        const product = await this.productRepository.findById(cartItem.productId);
        if (!product) {
          res.status(400).json({
            success: false,
            message: `Product ${cartItem.productId} not found`
          });
          return;
        }

        if (product.stock < cartItem.quantity) {
          res.status(400).json({
            success: false,
            message: `Insufficient stock for product ${product.title}. Available: ${product.stock}`
          });
          return;
        }

        orderItems.push({
          productId: product._id.toString(),
          title: product.title,
          price: product.price,
          quantity: cartItem.quantity,
          thumbnail: product.thumbnail
        });

        totalAmount += product.price * cartItem.quantity;
        totalItems += cartItem.quantity;
      }

      // Create order without payment intent ID first
      let order = await this.orderRepository.create({
        userId,
        items: orderItems,
        totalAmount,
        totalItems,
        shippingAddress,
        paymentMethod,
        paymentStatus: paymentMethod === 'COD' ? 'PENDING' : 'PENDING',
        orderStatus: 'PENDING'
      });

      // If online payment, create Stripe checkout session
      let checkoutSession = null;
      if (paymentMethod === 'ONLINE') {
        try {
          checkoutSession = await this.stripeService.createCheckoutSession(
            orderItems,
            successUrl,
            cancelUrl,
            {
              orderId: order._id.toString(),
              orderNumber: order.orderNumber,
              userId: userId
            }
          );

          // Update order with session ID
          const updatedOrder = await this.orderRepository.updateSessionId(
            order._id.toString(),
            checkoutSession.id
          );
          
          if (updatedOrder) {
            order = updatedOrder;
          }
        } catch (stripeError: any) {
          // If Stripe fails, delete the order and return error
          await this.orderRepository.deactivateOrder(order._id.toString());
          res.status(500).json({
            success: false,
            message: 'Failed to create checkout session. Please try again.',
            error: stripeError.message
          });
          return;
        }
      }

      // Clear cart after order creation
      await this.cartRepository.clearCart(cart._id.toString());

      logger.success(userId, 'createOrder', `Created order ${order.orderNumber} with ${totalItems} items`);

      // Return order with checkout session for online payments
      const responseData: any = {
        success: true,
        data: order,
        message: 'Order created successfully'
      };

      if (checkoutSession && paymentMethod === 'ONLINE') {
        responseData.checkoutSession = {
          id: checkoutSession.id,
          url: checkoutSession.url
        };
      }

      res.status(201).json(responseData);
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'createOrder', `Failed to create order: ${error.message}`);
      next(error);
    }
  }

  // Get user's orders
  async getUserOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      // Get all orders for the user
      const allOrders = await this.orderRepository.findByUserId(userId);
      
      // Apply pagination
      const totalRecords = allOrders.length;
      const data = allOrders.slice(skip, skip + limit);
      
      // Calculate pagination metadata
      const totalPages = Math.ceil(totalRecords / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      logger.success(userId, 'getUserOrders', `Retrieved ${data.length} orders (page ${page} of ${totalPages})`);

      res.status(200).json({
        success: true,
        data,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords,
          recordsPerPage: limit,
          hasNextPage,
          hasPrevPage,
        },
        message: 'Orders retrieved successfully'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'getUserOrders', `Failed to get user orders: ${error.message}`);
      next(error);
    }
  }

  // Get order by order number
  async getOrderByOrderNumber(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      const { orderNumber } = req.params;
      const orderNumberStr = Array.isArray(orderNumber) ? orderNumber[0] : orderNumber;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
        return;
      }

      if (!orderNumberStr) {
        res.status(400).json({
          success: false,
          message: 'Order number is required'
        });
        return;
      }

      const order = await this.orderRepository.findByOrderNumber(orderNumberStr);

      if (!order) {
        res.status(404).json({
          success: false,
          message: 'Order not found'
        });
        return;
      }

      // Check if order belongs to user
      if (order.userId !== userId) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        });
        return;
      }

      logger.success(userId, 'getOrderByOrderNumber', `Retrieved order ${orderNumberStr}`);

      res.status(200).json({
        success: true,
        data: order,
        message: 'Order retrieved successfully'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'getOrderByOrderNumber', `Failed to get order: ${error.message}`);
      next(error);
    }
  }

  // Get order by ID
  async getOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      const { orderId } = req.params;
      const orderIdStr = Array.isArray(orderId) ? orderId[0] : orderId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
        return;
      }

      if (!orderIdStr) {
        res.status(400).json({
          success: false,
          message: 'Order ID is required'
        });
        return;
      }

      const order = await this.orderRepository.findById(orderIdStr);

      if (!order) {
        res.status(404).json({
          success: false,
          message: 'Order not found'
        });
        return;
      }

      // Check if order belongs to user
      if (order.userId !== userId) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        });
        return;
      }

      logger.success(userId, 'getOrderById', `Retrieved order ${orderIdStr}`);

      res.status(200).json({
        success: true,
        data: order,
        message: 'Order retrieved successfully'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'getOrderById', `Failed to get order: ${error.message}`);
      next(error);
    }
  }

  // Cancel order
  async cancelOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      const { orderId } = req.params;
      const orderIdStr = Array.isArray(orderId) ? orderId[0] : orderId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
        return;
      }

      if (!orderIdStr) {
        res.status(400).json({
          success: false,
          message: 'Order ID is required'
        });
        return;
      }

      const order = await this.orderRepository.findById(orderIdStr);

      if (!order) {
        res.status(404).json({
          success: false,
          message: 'Order not found'
        });
        return;
      }

      // Check if order belongs to user
      if (order.userId !== userId) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        });
        return;
      }

      // Check if order can be cancelled
      if (order.orderStatus === 'SHIPPED' || order.orderStatus === 'DELIVERED') {
        res.status(400).json({
          success: false,
          message: 'Order cannot be cancelled. Current status: ' + order.orderStatus
        });
        return;
      }

      // If order is paid, issue refund through Stripe
      if (order.paymentStatus === 'PAID' && order.sessionId) {
        try {
          await this.stripeService.createRefund(order.sessionId);
          logger.success(userId, 'cancelOrder', `Refund issued for order ${order.orderNumber}`);
        } catch (refundError: any) {
          logger.error(userId, 'cancelOrder', `Failed to issue refund: ${refundError.message}`);
          // Still cancel order even if refund fails
        }
      }

      const cancelledOrder = await this.orderRepository.cancelOrder(orderIdStr);

      logger.success(userId, 'cancelOrder', `Cancelled order ${orderIdStr}`);

      res.status(200).json({
        success: true,
        data: cancelledOrder,
        message: 'Order cancelled successfully'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'cancelOrder', `Failed to cancel order: ${error.message}`);
      next(error);
    }
  }

  // Get order statistics
  async getOrderStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
        return;
      }

      const stats = await this.orderRepository.getOrderStats(userId);

      logger.success(userId, 'getOrderStats', `Retrieved order statistics`);

      res.status(200).json({
        success: true,
        data: stats,
        message: 'Order statistics retrieved successfully'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'getOrderStats', `Failed to get order stats: ${error.message}`);
      next(error);
    }
  }

  // Admin: Get all orders
  async getAllOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;
      const status = req.query.status as any;

      // Get all orders (without pagination for total count)
      const allOrders = await this.orderRepository.getAllOrders(1000, 0, status);
      
      // Apply pagination
      const totalRecords = allOrders.length;
      const data = allOrders.slice(skip, skip + limit);
      
      // Calculate pagination metadata
      const totalPages = Math.ceil(totalRecords / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      logger.success(req.user?._id?.toString() || 'admin', 'getAllOrders', `Retrieved ${data.length} orders (page ${page} of ${totalPages})`);

      res.status(200).json({
        success: true,
        data,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords,
          recordsPerPage: limit,
          hasNextPage,
          hasPrevPage,
        },
        message: 'All orders retrieved successfully'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'admin', 'getAllOrders', `Failed to get all orders: ${error.message}`);
      next(error);
    }
  }

  // Get payment history for user
  async getPaymentHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      // Get all orders for the user
      const orders = await this.orderRepository.findByUserId(userId);
      
      // Extract payment information from orders
      const allPaymentHistory = orders
        .filter(order => order.paymentMethod === 'ONLINE' && (order.sessionId || order.transactionId))
        .map(order => ({
          orderId: order._id,
          orderNumber: order.orderNumber,
          sessionId: order.sessionId,
          transactionId: order.transactionId,
          amount: order.totalAmount,
          paymentStatus: order.paymentStatus,
          orderStatus: order.orderStatus,
          paymentMethod: order.paymentMethod,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt
        }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Apply pagination
      const totalRecords = allPaymentHistory.length;
      const data = allPaymentHistory.slice(skip, skip + limit);
      
      // Calculate pagination metadata
      const totalPages = Math.ceil(totalRecords / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      logger.success(userId, 'getPaymentHistory', `Retrieved ${data.length} payment records (page ${page} of ${totalPages})`);

      res.status(200).json({
        success: true,
        data,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords,
          recordsPerPage: limit,
          hasNextPage,
          hasPrevPage,
        },
        message: 'Payment history retrieved successfully'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'getPaymentHistory', `Failed to get payment history: ${error.message}`);
      next(error);
    }
  }

  // Admin: Update order status
  async updateOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderId } = req.params;
      const { status } = req.body;
      const orderIdStr = Array.isArray(orderId) ? orderId[0] : orderId;

      if (!orderIdStr) {
        res.status(400).json({
          success: false,
          message: 'Order ID is required'
        });
        return;
      }

      if (!status) {
        res.status(400).json({
          success: false,
          message: 'Order status is required'
        });
        return;
      }

      const validStatuses = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Invalid order status'
        });
        return;
      }

      const updatedOrder = await this.orderRepository.updateOrderStatus(orderIdStr, status);

      if (!updatedOrder) {
        res.status(404).json({
          success: false,
          message: 'Order not found'
        });
        return;
      }

      logger.success(req.user?._id?.toString() || 'admin', 'updateOrderStatus', `Updated order ${orderIdStr} status to ${status}`);

      res.status(200).json({
        success: true,
        data: updatedOrder,
        message: 'Order status updated successfully'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'admin', 'updateOrderStatus', `Failed to update order status: ${error.message}`);
      next(error);
    }
  }
}
