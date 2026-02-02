import { Request, Response, NextFunction } from 'express';
import { WishlistRepository } from '../repository/WishlistRepository';
import { ProductRepository } from '../repository/ProductRepository';
import { logger } from '../../utils/logger';

export class WishlistController {
  private wishlistRepository: WishlistRepository;
  private productRepository: ProductRepository;

  constructor() {
    this.wishlistRepository = new WishlistRepository();
    this.productRepository = new ProductRepository();
  }

  // Get or create wishlist for user only
  private async getOrCreateWishlist(req: Request) {
    const userId = req.user?._id?.toString();
    
    if (!userId) {
      throw new Error('User authentication required');
    }

    return await this.wishlistRepository.getOrCreateWishlist(userId);
  }

  // Get wishlist
  async getWishlist(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?._id?.toString();

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
        return;
      }

      let wishlist = await this.wishlistRepository.findByUserId(userId);
      
      if (!wishlist) {
        wishlist = await this.wishlistRepository.create({
          userId,
          items: [],
          isActive: true
        });
      }

      logger.success(userId, 'getWishlist', `Retrieved wishlist with ${wishlist.items.length} items`);

      res.status(200).json({
        success: true,
        data: wishlist,
        message: 'Wishlist retrieved successfully'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'getWishlist', `Failed to get wishlist: ${error.message}`);
      next(error);
    }
  }

  // Add item to wishlist
  async addToWishlist(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.body;

      if (!productId) {
        res.status(400).json({
          success: false,
          message: 'Product ID is required'
        });
        return;
      }

      // Get product details
      const product = await this.productRepository.findById(productId);
      if (!product) {
        res.status(404).json({
          success: false,
          message: 'Product not found'
        });
        return;
      }

      // Get or create wishlist
      const wishlist = await this.getOrCreateWishlist(req);

      // Add item to wishlist
      const updatedWishlist = await this.wishlistRepository.addItem(wishlist._id.toString(), {
        productId: product._id.toString(),
        title: product.title,
        price: product.price,
        thumbnail: product.thumbnail
      });

      if (!updatedWishlist) {
        res.status(404).json({
          success: false,
          message: 'Wishlist not found'
        });
        return;
      }

      logger.success(req.user?._id?.toString() || 'anonymous', 'addToWishlist', `Added product ${productId} to wishlist`);

      res.status(200).json({
        success: true,
        data: updatedWishlist,
        message: 'Item added to wishlist successfully'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'addToWishlist', `Failed to add item to wishlist: ${error.message}`);
      next(error);
    }
  }

  // Remove item from wishlist
  async removeFromWishlist(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;
      const productIdStr = Array.isArray(productId) ? productId[0] : productId;

      if (!productIdStr) {
        res.status(400).json({
          success: false,
          message: 'Product ID is required'
        });
        return;
      }

      // Get wishlist
      const wishlist = await this.getOrCreateWishlist(req);

      // Remove item from wishlist
      const updatedWishlist = await this.wishlistRepository.removeItem(wishlist._id.toString(), productIdStr);

      if (!updatedWishlist) {
        res.status(404).json({
          success: false,
          message: 'Wishlist not found'
        });
        return;
      }

      logger.success(req.user?._id?.toString() || 'anonymous', 'removeFromWishlist', `Removed product ${productIdStr} from wishlist`);

      res.status(200).json({
        success: true,
        data: updatedWishlist,
        message: 'Item removed from wishlist successfully'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'removeFromWishlist', `Failed to remove item from wishlist: ${error.message}`);
      next(error);
    }
  }

  // Clear wishlist
  async clearWishlist(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Get wishlist
      const wishlist = await this.getOrCreateWishlist(req);

      // Clear wishlist
      const clearedWishlist = await this.wishlistRepository.clearWishlist(wishlist._id.toString());

      if (!clearedWishlist) {
        res.status(404).json({
          success: false,
          message: 'Wishlist not found'
        });
        return;
      }

      logger.success(req.user?._id?.toString() || 'anonymous', 'clearWishlist', 'Cleared wishlist');

      res.status(200).json({
        success: true,
        data: clearedWishlist,
        message: 'Wishlist cleared successfully'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'clearWishlist', `Failed to clear wishlist: ${error.message}`);
      next(error);
    }
  }

  // Get wishlist statistics
  async getWishlistStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Get wishlist
      const wishlist = await this.getOrCreateWishlist(req);

      // Get statistics
      const stats = await this.wishlistRepository.getWishlistStats(wishlist._id.toString());

      if (!stats) {
        res.status(404).json({
          success: false,
          message: 'Wishlist not found'
        });
        return;
      }

      logger.success(req.user?._id?.toString() || 'anonymous', 'getWishlistStats', `Retrieved wishlist stats: ${stats.itemCount} items`);

      res.status(200).json({
        success: true,
        data: stats,
        message: 'Wishlist statistics retrieved successfully'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'getWishlistStats', `Failed to get wishlist stats: ${error.message}`);
      next(error);
    }
  }
}
