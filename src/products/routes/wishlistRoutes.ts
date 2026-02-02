import { Router } from 'express';
import { WishlistController } from '../controller/WishlistController';
import { authenticateToken } from '../../middleware/auth';

const router = Router();
const wishlistController = new WishlistController();

// All wishlist routes require authentication
router.get('/', authenticateToken, wishlistController.getWishlist.bind(wishlistController));
router.post('/add', authenticateToken, wishlistController.addToWishlist.bind(wishlistController));
router.delete('/item/:productId', authenticateToken, wishlistController.removeFromWishlist.bind(wishlistController));
router.delete('/clear', authenticateToken, wishlistController.clearWishlist.bind(wishlistController));
router.get('/stats', authenticateToken, wishlistController.getWishlistStats.bind(wishlistController));

export default router;
