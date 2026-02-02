import { Router } from 'express';
import { OrderController } from '../controller/OrderController';
import { StripeWebhookController } from '../controller/StripeWebhookController';
import { authenticateToken, requireAdmin } from '../../middleware/auth';

const router = Router();
const orderController = new OrderController();
const stripeWebhookController = new StripeWebhookController();

// User order routes (require authentication)
router.post('/', authenticateToken, orderController.createOrder.bind(orderController));
router.get('/', authenticateToken, orderController.getUserOrders.bind(orderController));
router.get('/stats', authenticateToken, orderController.getOrderStats.bind(orderController));
router.get('/order/:orderNumber', authenticateToken, orderController.getOrderByOrderNumber.bind(orderController));
router.get('/:orderId', authenticateToken, orderController.getOrderById.bind(orderController));
router.delete('/:orderId/cancel', authenticateToken, orderController.cancelOrder.bind(orderController));

// Payment history routes
router.get('/payments/history', authenticateToken, orderController.getPaymentHistory.bind(orderController));

// Admin only routes
router.get('/admin/all', authenticateToken, requireAdmin, orderController.getAllOrders.bind(orderController));
router.put('/admin/:orderId/status', authenticateToken, requireAdmin, orderController.updateOrderStatus.bind(orderController));

// Stripe webhook endpoint (no authentication required)
router.post('/checkout/webhook', stripeWebhookController.handleWebhook.bind(stripeWebhookController));

export default router;
