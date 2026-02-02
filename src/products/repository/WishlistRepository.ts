import { Wishlist, WishlistModel } from '../models/Wishlist';
import { logger } from '../../utils/logger';

export class WishlistRepository {
  // Create new wishlist
  async create(wishlistData: Partial<Wishlist>): Promise<Wishlist> {
    try {
      const wishlist = new WishlistModel(wishlistData);
      return await wishlist.save();
    } catch (error: any) {
      logger.error('WishlistRepository', 'create', `Failed to create wishlist: ${error.message}`);
      throw error;
    }
  }

  // Find wishlist by ID
  async findById(id: string): Promise<Wishlist | null> {
    try {
      return await WishlistModel.findById(id);
    } catch (error: any) {
      logger.error('WishlistRepository', 'findById', `Failed to find wishlist by ID: ${error.message}`);
      throw error;
    }
  }

  // Find wishlist by user ID
  async findByUserId(userId: string): Promise<Wishlist | null> {
    try {
      return await WishlistModel.findOne({ userId, isActive: true });
    } catch (error: any) {
      logger.error('WishlistRepository', 'findByUserId', `Failed to find wishlist by user ID: ${error.message}`);
      throw error;
    }
  }

  // Get or create wishlist for user only
  async getOrCreateWishlist(userId: string): Promise<Wishlist> {
    try {
      let wishlist = await this.findByUserId(userId);

      if (!wishlist) {
        wishlist = await this.create({
          userId,
          items: [],
          isActive: true
        });
      }

      return wishlist;
    } catch (error: any) {
      logger.error('WishlistRepository', 'getOrCreateWishlist', `Failed to get or create wishlist: ${error.message}`);
      throw error;
    }
  }

  // Add item to wishlist
  async addItem(wishlistId: string, item: {
    productId: string;
    title: string;
    price: number;
    thumbnail: string;
  }): Promise<Wishlist | null> {
    try {
      const wishlist = await this.findById(wishlistId);
      if (!wishlist) {
        return null;
      }

      // Check if item already exists
      const existingItem = wishlist.items.find(wishlistItem => 
        wishlistItem.productId === item.productId
      );

      if (!existingItem) {
        wishlist.items.push({
          ...item,
          addedAt: new Date()
        });
        return await wishlist.save();
      }

      return wishlist; // Item already exists
    } catch (error: any) {
      logger.error('WishlistRepository', 'addItem', `Failed to add item to wishlist: ${error.message}`);
      throw error;
    }
  }

  // Remove item from wishlist
  async removeItem(wishlistId: string, productId: string): Promise<Wishlist | null> {
    try {
      const wishlist = await this.findById(wishlistId);
      if (!wishlist) {
        return null;
      }

      wishlist.items = wishlist.items.filter(item => item.productId !== productId);
      return await wishlist.save();
    } catch (error: any) {
      logger.error('WishlistRepository', 'removeItem', `Failed to remove item from wishlist: ${error.message}`);
      throw error;
    }
  }

  // Clear wishlist
  async clearWishlist(wishlistId: string): Promise<Wishlist | null> {
    try {
      const wishlist = await this.findById(wishlistId);
      if (!wishlist) {
        return null;
      }

      wishlist.items = [];
      return await wishlist.save();
    } catch (error: any) {
      logger.error('WishlistRepository', 'clearWishlist', `Failed to clear wishlist: ${error.message}`);
      throw error;
    }
  }

  // Get wishlist statistics
  async getWishlistStats(wishlistId: string): Promise<{ itemCount: number } | null> {
    try {
      const wishlist = await this.findById(wishlistId);
      if (!wishlist) {
        return null;
      }

      return {
        itemCount: wishlist.items.length
      };
    } catch (error: any) {
      logger.error('WishlistRepository', 'getWishlistStats', `Failed to get wishlist stats: ${error.message}`);
      throw error;
    }
  }

  // Deactivate wishlist
  async deactivateWishlist(wishlistId: string): Promise<boolean> {
    try {
      const result = await WishlistModel.findByIdAndUpdate(
        wishlistId,
        { isActive: false },
        { new: true }
      );
      return result !== null;
    } catch (error: any) {
      logger.error('WishlistRepository', 'deactivateWishlist', `Failed to deactivate wishlist: ${error.message}`);
      throw error;
    }
  }
}
