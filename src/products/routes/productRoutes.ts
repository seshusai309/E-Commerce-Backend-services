import { Router } from 'express';
import { ProductController } from '../controller/ProductController';
import { authenticateToken, requireAdmin, requireSuperAdmin } from '../../middleware/auth';

const router = Router();
const productController = new ProductController();

// Public routes (product browsing)
router.get('/', productController.getProducts.bind(productController));
router.get('/search', productController.searchProducts.bind(productController));
router.get('/categories', productController.getCategories.bind(productController));
router.get('/category', productController.getProductsByCategory.bind(productController));
router.get('/stats', productController.getProductStats.bind(productController));

// Public routes (product details)
router.get('/:id', productController.getProductById.bind(productController));

// Admin only routes (product management)
router.post('/', authenticateToken, requireAdmin, productController.createProduct.bind(productController));
router.put('/:id', authenticateToken, requireAdmin, productController.updateProduct.bind(productController));
router.delete('/:id', authenticateToken, requireAdmin, productController.deleteProduct.bind(productController));
router.post('/bulk-update', authenticateToken, requireAdmin, productController.bulkUpdateProducts.bind(productController));

// Super admin only routes (data management)
router.post('/fetch-store', authenticateToken, requireSuperAdmin, productController.fetchAndStoreProducts.bind(productController));
router.post('/update-existing', authenticateToken, requireSuperAdmin, productController.updateExistingProducts.bind(productController));

export default router;
