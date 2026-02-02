import { Request, Response, NextFunction } from 'express';
import { StripeService } from '../services/StripeService';
import { OrderRepository } from '../repository/OrderRepository';
import { logger } from '../../utils/logger';
import Stripe from 'stripe';

export class StripeWebhookController {
  private orderRepository: OrderRepository;

  constructor() {
    this.orderRepository = new OrderRepository();
  }

  // Handle Stripe webhooks
  async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sig = req.headers['stripe-signature'] as string;
      
      // For testing: Skip signature verification if no signature provided
      let event: Stripe.Event;

      if (sig && sig !== 'test-signature') {
        try {
          event = StripeService.verifyWebhookSignature(req.body, sig);
        } catch (err: any) {
          logger.error('StripeWebhookController', 'handleWebhook', `Webhook signature verification failed: ${err.message}`);
          res.status(400).json({
            success: false,
            message: 'Webhook signature verification failed'
          });
          return;
        }
      } else {
        // For testing: Create event from request body
        event = req.body as Stripe.Event;
        
        // Validate event structure
        if (!event || !event.type) {
          logger.error('StripeWebhookController', 'handleWebhook', 'Invalid webhook event structure');
          res.status(400).json({
            success: false,
            message: 'Invalid webhook event structure'
          });
          return;
        }
        
        logger.success('StripeWebhookController', 'handleWebhook', `Processing test webhook: ${event.type}`);
      }

      // Handle the event
      const result = await this.processWebhookEvent(event);

      if (result.processed) {
        res.status(200).json({
          success: true,
          message: result.message,
          received: true
        });
      } else {
        res.status(200).json({
          success: true,
          message: result.message,
          received: true
        });
      }
    } catch (error: any) {
      logger.error('StripeWebhookController', 'handleWebhook', `Webhook processing failed: ${error.message}`);
      next(error);
    }
  }

  // Process webhook events
  private async processWebhookEvent(event: any): Promise<{ processed: boolean; message: string }> {
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          return await this.handleCheckoutSessionCompleted(event);
        
        default:
          logger.success('StripeWebhookController', 'processWebhookEvent', `Unhandled event type: ${event.type}`);
          return { 
            processed: false, 
            message: `Unhandled event type: ${event.type}` 
          };
      }
    } catch (error: any) {
      logger.error('StripeWebhookController', 'processWebhookEvent', `Error processing webhook event: ${error.message}`);
      throw error;
    }
  }

  // Handle checkout session completed
  private async handleCheckoutSessionCompleted(session: any): Promise<{ processed: boolean; message: string }> {
    try {
      // Handle simplified structure
      const sessionId = session.id || session.data?.object?.id;
      const orderNum = session.orderNum || session.metadata?.orderNum;
      
      if (!sessionId || !orderNum) {
        logger.error('StripeWebhookController', 'handleCheckoutSessionCompleted', `Missing session ID or order ID`);
        return { 
          processed: false, 
          message: `Missing session ID or order ID` 
        };
      }

      // Fetch session details from Stripe API to get real payment status
      const { StripeService } = await import('../services/StripeService');
      const stripeService = new StripeService();
      
      let stripeSession;
      try {
        stripeSession = await stripeService.retrieveCheckoutSession(sessionId);
      } catch (error: any) {
        logger.error('StripeWebhookController', 'handleCheckoutSessionCompleted', `Failed to retrieve session from Stripe: ${error.message}`);
        return { 
          processed: false, 
          message: `Failed to retrieve session from Stripe` 
        };
      }

      // Find order by order number
      const order = await this.orderRepository.findByOrderNumber(orderNum);
       
      if (!order) {
        logger.error('StripeWebhookController', 'handleCheckoutSessionCompleted', `Order not found: ${orderNum}`);
        return { 
          processed: false, 
          message: `Order not found: ${orderNum}` 
        };
      }

      // Update order payment status based on Stripe's actual payment status
      const paymentStatus = stripeSession.payment_status === 'paid' ? 'PAID' : 'PENDING';
      
      const updatedOrder = await this.orderRepository.updatePaymentStatus(
        order._id.toString(),
        paymentStatus,
        sessionId
      );

      if (updatedOrder) {
        logger.success('StripeWebhookController', 'handleCheckoutSessionCompleted', `Checkout processed for order ${order.orderNumber} with status: ${paymentStatus}`);
        return { 
          processed: true, 
          message: `Checkout processed for order ${order.orderNumber} with status: ${paymentStatus}` 
        };
      }

      logger.success('StripeWebhookController', 'handleCheckoutSessionCompleted', `Checkout session processed: ${sessionId}`);
      return { 
        processed: true, 
        message: `Checkout session processed: ${sessionId}` 
      };
    } catch (error: any) {
      logger.error('StripeWebhookController', 'handleCheckoutSessionCompleted', `Error handling checkout session: ${error.message}`);
      throw error;
    }
  }
}
