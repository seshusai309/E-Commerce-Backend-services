import { Router } from 'express';
import { CartController } from '../controller/CartController';
import { authenticateToken, requireUser, requireAdmin } from '../../middleware/auth';
import { optionalAuth } from '../../middleware/optionalAuth';

const router = Router();
const cartController = new CartController();

// Unified cart routes (guest or user cart - automatically detected)
router.get('/', optionalAuth, cartController.getCart.bind(cartController));
router.get('/:cartId', optionalAuth, cartController.getCartById.bind(cartController));
router.post('/add', optionalAuth, cartController.addToCart.bind(cartController));
router.put('/item/:productId', optionalAuth, cartController.updateCartItem.bind(cartController));
router.delete('/item/:productId', optionalAuth, cartController.removeFromCart.bind(cartController));
router.delete('/clear', optionalAuth, cartController.clearCart.bind(cartController));
router.get('/stats', optionalAuth, cartController.getCartStats.bind(cartController));
router.post('/validate', optionalAuth, cartController.validateCart.bind(cartController));

// Admin only routes
router.get('/guest-carts', authenticateToken, requireAdmin, cartController.getAllGuestCarts.bind(cartController));

// User only routes (merge guest cart)
router.post('/merge-guest', authenticateToken, cartController.mergeGuestCart.bind(cartController));

export default router;
