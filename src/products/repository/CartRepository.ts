import { Cart, CartModel, CartItem } from '../models/Cart';
import { logger } from '../../utils/logger';

export class CartRepository {
  // Create a new cart
  async create(cartData: Partial<Cart>): Promise<Cart> {
    try {
      const cart = new CartModel(cartData);
      return await cart.save();
    } catch (error: any) {
      logger.error('CartRepository', 'create', `Failed to create cart: ${error.message}`);
      throw error;
    }
  }

  // Find cart by user ID
  async findByUserId(userId: string): Promise<Cart | null> {
    try {
      return await CartModel.findOne({ userId, isActive: true });
    } catch (error: any) {
      logger.error('CartRepository', 'findByUserId', `Failed to find cart: ${error.message}`);
      throw error;
    }
  }

  // Find cart by ID
  async findById(id: string): Promise<Cart | null> {
    try {
      return await CartModel.findById(id);
    } catch (error: any) {
      logger.error('CartRepository', 'findById', `Failed to find cart: ${error.message}`);
      throw error;
    }
  }

  // Add item to cart
  async addItem(cartId: string, item: CartItem): Promise<Cart | null> {
    try {
      const cart = await CartModel.findById(cartId);
      if (!cart) {
        return null;
      }

      // Check if item already exists
      const existingItemIndex = cart.items.findIndex(
        cartItem => cartItem.productId === item.productId
      );

      if (existingItemIndex >= 0) {
        // Update quantity if item exists
        cart.items[existingItemIndex].quantity += item.quantity;
      } else {
        // Add new item
        cart.items.push(item);
      }

      // Recalculate totals
      cart.totalItems = cart.items.reduce((total, item) => total + item.quantity, 0);
      cart.totalAmount = cart.items.reduce((total, item) => total + (item.price * item.quantity), 0);

      return await cart.save();
    } catch (error: any) {
      logger.error('CartRepository', 'addItem', `Failed to add item to cart: ${error.message}`);
      throw error;
    }
  }

  // Update item quantity in cart
  async updateItemQuantity(cartId: string, productId: string, quantity: number): Promise<Cart | null> {
    try {
      const cart = await CartModel.findById(cartId);
      if (!cart) {
        return null;
      }

      const itemIndex = cart.items.findIndex(item => item.productId === productId);
      if (itemIndex === -1) {
        return null;
      }

      if (quantity <= 0) {
        // Remove item if quantity is 0 or less
        cart.items.splice(itemIndex, 1);
      } else {
        // Update quantity
        cart.items[itemIndex].quantity = quantity;
      }

      // Recalculate totals
      cart.totalItems = cart.items.reduce((total, item) => total + item.quantity, 0);
      cart.totalAmount = cart.items.reduce((total, item) => total + (item.price * item.quantity), 0);

      return await cart.save();
    } catch (error: any) {
      logger.error('CartRepository', 'updateItemQuantity', `Failed to update item quantity: ${error.message}`);
      throw error;
    }
  }

  // Remove item from cart
  async removeItem(cartId: string, productId: string): Promise<Cart | null> {
    try {
      const cart = await CartModel.findById(cartId);
      if (!cart) {
        return null;
      }

      cart.items = cart.items.filter(item => item.productId !== productId);

      // Recalculate totals
      cart.totalItems = cart.items.reduce((total, item) => total + item.quantity, 0);
      cart.totalAmount = cart.items.reduce((total, item) => total + (item.price * item.quantity), 0);

      return await cart.save();
    } catch (error: any) {
      logger.error('CartRepository', 'removeItem', `Failed to remove item from cart: ${error.message}`);
      throw error;
    }
  }

  // Find all guest carts (carts without userId)
  async findAllGuestCarts(): Promise<Cart[]> {
    try {
      return await CartModel.find({ 
        userId: { $exists: false }, 
        isActive: true 
      }).sort({ createdAt: -1 });
    } catch (error: any) {
      logger.error('CartRepository', 'findAllGuestCarts', `Failed to find guest carts: ${error.message}`);
      throw error;
    }
  }

  // Clear cart
  async clearCart(cartId: string): Promise<Cart | null> {
    try {
      const cart = await CartModel.findById(cartId);
      if (!cart) {
        return null;
      }

      cart.items = [];
      cart.totalItems = 0;
      cart.totalAmount = 0;

      return await cart.save();
    } catch (error: any) {
      logger.error('CartRepository', 'clearCart', `Failed to clear cart: ${error.message}`);
      throw error;
    }
  }

  // Deactivate cart (mark as inactive)
  async deactivateCart(cartId: string): Promise<Cart | null> {
    try {
      return await CartModel.findByIdAndUpdate(
        cartId,
        { isActive: false },
        { new: true }
      );
    } catch (error: any) {
      logger.error('CartRepository', 'deactivateCart', `Failed to deactivate cart: ${error.message}`);
      throw error;
    }
  }

  // Get or create cart for user/guest
  async getOrCreateCart(userId?: string, guestId?: string): Promise<Cart> {
    try {
      let cart: Cart | null = null;

      if (userId) {
        cart = await this.findByUserId(userId);
      } else if (guestId) {
        // For guest carts, find by _id (since we don't store guestId anymore)
        cart = await this.findById(guestId);
      }

      if (!cart) {
        cart = await this.create({
          userId: userId || null, // Use null for guests
          items: [],
          totalAmount: 0,
          totalItems: 0,
          isActive: true
        });
      }

      return cart;
    } catch (error: any) {
      logger.error('CartRepository', 'getOrCreateCart', `Failed to get or create cart: ${error.message}`);
      throw error;
    }
  }

  // Merge guest cart with user cart
  async mergeGuestCart(guestCartId: string, userId: string): Promise<Cart | null> {
    try {
      const guestCart = await this.findById(guestCartId);
      if (!guestCart) {
        return null;
      }

      // Check if user already has a cart
      let userCart = await this.findByUserId(userId);
      
      if (!userCart) {
        // No existing user cart - just add userId to guest cart
        userCart = await CartModel.findByIdAndUpdate(
          guestCartId,
          { userId }, // Simply add userId to existing guest cart
          { new: true }
        );
      } else {
        // User has existing cart - merge items
        for (const guestItem of guestCart.items) {
          const existingItemIndex = userCart.items.findIndex(
            userItem => userItem.productId === guestItem.productId
          );

          if (existingItemIndex >= 0) {
            userCart.items[existingItemIndex].quantity += guestItem.quantity;
          } else {
            userCart.items.push(guestItem);
          }
        }

        // Recalculate totals
        userCart.totalItems = userCart.items.reduce((total, item) => total + item.quantity, 0);
        userCart.totalAmount = userCart.items.reduce((total, item) => total + (item.price * item.quantity), 0);

        userCart = await userCart.save();
        
        // Deactivate the guest cart after merging
        await this.deactivateCart(guestCartId);
      }

      return userCart;
    } catch (error: any) {
      logger.error('CartRepository', 'mergeGuestCart', `Failed to merge guest cart: ${error.message}`);
      throw error;
    }
  }

  // Get cart statistics
  async getCartStats(cartId: string): Promise<{ totalItems: number, totalAmount: number, itemCount: number } | null> {
    try {
      const cart = await CartModel.findById(cartId);
      if (!cart) {
        return null;
      }

      return {
        totalItems: cart.totalItems,
        totalAmount: cart.totalAmount,
        itemCount: cart.items.length
      };
    } catch (error: any) {
      logger.error('CartRepository', 'getCartStats', `Failed to get cart stats: ${error.message}`);
      throw error;
    }
  }
}
