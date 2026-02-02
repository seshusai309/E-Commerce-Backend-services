import { Request, Response, NextFunction } from 'express';
import { CartRepository } from '../repository/CartRepository';
import { ProductRepository } from '../repository/ProductRepository';
import { logger } from '../../utils/logger';

export class CartController {
  private cartRepository: CartRepository;
  private productRepository: ProductRepository;

  constructor() {
    this.cartRepository = new CartRepository();
    this.productRepository = new ProductRepository();
  }

  // Get or create cart for user/guest
  private async getOrCreateCart(req: Request) {
    const userId = req.user?._id?.toString();
    const guestId = req.cookies?.guest_id; // ✅ Use guest_id consistently

    return await this.cartRepository.getOrCreateCart(userId, guestId);
  }

  // Get cart
  async getCart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      let guestId = req.cookies?.guest_id; // ✅ Use guest_id consistently

      let cart;

      // If user is authenticated, use user cart (ignore guest ID)
      if (userId) {
        cart = await this.cartRepository.findByUserId(userId);
        if (!cart) {
          cart = await this.cartRepository.create({
            userId,
            items: [],
            totalAmount: 0,
            totalItems: 0,
            isActive: true
          });
        }
      } else {
        // No user token, handle guest cart
        if (!guestId) {
          // No guest ID found, create cart directly and use its _id as guestId
          cart = await this.cartRepository.create({
            userId: null, // ✅ Use null for guests (consistent with schema)
            items: [],
            totalAmount: 0,
            totalItems: 0,
            isActive: true
          });
          
          // Use the cart's _id as guestId for cookie
          const guestIdForCookie = cart._id.toString();
          
          // Store guest ID in HTTP-only cookie
          res.cookie('guest_id', guestIdForCookie, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
          });
        } else {
          cart = await this.cartRepository.findById(guestId);
          if (!cart) {
            cart = await this.cartRepository.create({
              userId: null, // ✅ Use null for guests (consistent with schema)
              items: [],
              totalAmount: 0,
              totalItems: 0,
              isActive: true
            });
          }
        }
      }

      logger.success(req.user?._id?.toString() || 'anonymous', 'getCart', `Retrieved cart with ${cart.items.length} items`);

      res.status(200).json({
        success: true,
        data: cart,
        message: 'Cart retrieved successfully'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'getCart', `Failed to get cart: ${error.message}`);
      next(error);
    }
  }

  // Add item to cart
  async addToCart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId, quantity = 1 } = req.body;

      if (!productId || quantity <= 0) {
        res.status(400).json({
          success: false,
          message: 'Valid product ID and quantity are required'
        });
        return;
      }

      // Get product details by MongoDB _id
      const product = await this.productRepository.findById(productId);
      if (!product) {
        res.status(404).json({
          success: false,
          message: 'Product not found'
        });
        return;
      }

      // Get or create cart
      const cart = await this.getOrCreateCart(req);

      // Create cart item
      const cartItem = {
        productId: product._id.toString(), // Use MongoDB _id
        title: product.title,
        price: product.price,
        quantity,
        thumbnail: product.thumbnail,
        addedAt: new Date()
      };

      // Add item to cart
      const updatedCart = await this.cartRepository.addItem(cart._id.toString(), cartItem);

      logger.success(req.user?._id?.toString() || 'anonymous', 'addToCart', `Added ${quantity} x ${product.title} to cart`);

      res.status(200).json({
        success: true,
        data: updatedCart,
        message: 'Item added to cart successfully'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'addToCart', `Failed to add item to cart: ${error.message}`);
      next(error);
    }
  }

  // Update item quantity in cart
  async updateCartItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;
      const productIdStr = Array.isArray(productId) ? productId[0] : productId;
      const { quantity } = req.body;

      if (!productIdStr || !quantity || quantity <= 0) {
        res.status(400).json({
          success: false,
          message: 'Valid product ID and quantity are required'
        });
        return;
      }

      // Get cart
      const cart = await this.getOrCreateCart(req);

      // Check if product exists and has enough stock
      const product = await this.productRepository.findById(productIdStr);
      if (!product) {
        res.status(404).json({
          success: false,
          message: 'Product not found'
        });
        return;
      }

      if (product.stock < quantity) {
        res.status(400).json({
          success: false,
          message: `Only ${product.stock} items available in stock`
        });
        return;
      }

      // Update cart item
      const updatedCart = await this.cartRepository.updateItemQuantity(
        cart._id.toString(),
        productIdStr, // Use MongoDB _id
        quantity
      );

      if (!updatedCart) {
        res.status(404).json({
          success: false,
          message: 'Cart item not found'
        });
        return;
      }

      logger.success(req.user?._id?.toString() || 'anonymous', 'updateCartItem', `Updated quantity for product ${productIdStr} to ${quantity}`);

      res.status(200).json({
        success: true,
        data: updatedCart,
        message: 'Cart item updated successfully'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'updateCartItem', `Failed to update cart item: ${error.message}`);
      next(error);
    }
  }

  // Remove item from cart
  async removeFromCart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;
      const productIdStr = Array.isArray(productId) ? productId[0] : productId;

      if (!productIdStr) {
        res.status(400).json({
          success: false,
          message: 'Valid product ID is required'
        });
        return;
      }

      // Get cart
      const cart = await this.getOrCreateCart(req);

      // Remove item from cart
      const updatedCart = await this.cartRepository.removeItem(cart._id.toString(), productIdStr);

      if (!updatedCart) {
        res.status(404).json({
          success: false,
          message: 'Item not found in cart'
        });
        return;
      }

      logger.success(req.user?._id?.toString() || 'anonymous', 'removeFromCart', `Removed product ${productIdStr} from cart`);

      res.status(200).json({
        success: true,
        data: updatedCart,
        message: 'Item removed from cart successfully'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'removeFromCart', `Failed to remove item from cart: ${error.message}`);
      next(error);
    }
  }

  // Clear cart
  async clearCart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Get cart
      const cart = await this.getOrCreateCart(req);

      // Clear cart
      const clearedCart = await this.cartRepository.clearCart(cart._id.toString());

      logger.success(req.user?._id?.toString() || 'anonymous', 'clearCart', 'Cleared cart');

      res.status(200).json({
        success: true,
        data: clearedCart,
        message: 'Cart cleared successfully'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'clearCart', `Failed to clear cart: ${error.message}`);
      next(error);
    }
  }

  // Get cart statistics
  async getCartStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Get cart
      const cart = await this.getOrCreateCart(req);

      // Get statistics
      const stats = await this.cartRepository.getCartStats(cart._id.toString());

      logger.success(req.user?._id?.toString() || 'anonymous', 'getCartStats', `Retrieved cart stats`);

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'getCartStats', `Failed to get cart stats: ${error.message}`);
      next(error);
    }
  }

  // Get all guest carts (admin only)
  async getAllGuestCarts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      // Get all guest carts (without pagination for total count)
      const allGuestCarts = await this.cartRepository.findAllGuestCarts();
      
      // Apply pagination
      const totalRecords = allGuestCarts.length;
      const data = allGuestCarts.slice(skip, skip + limit);
      
      // Calculate pagination metadata
      const totalPages = Math.ceil(totalRecords / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      logger.success(user?.username || 'anonymous', 'getAllGuestCarts', `Retrieved ${data.length} guest carts (page ${page} of ${totalPages})`);

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
        message: 'Guest carts retrieved successfully'
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'anonymous', 'getAllGuestCarts', `Failed to get guest carts: ${error.message}`);
      next(error);
    }
  }

  // Get cart by ID (MongoDB _id)
  async getCartById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cartId } = req.params;
      const cartIdStr = Array.isArray(cartId) ? cartId[0] : cartId;

      if (!cartIdStr) {
        res.status(400).json({
          success: false,
          message: 'Cart ID is required'
        });
        return;
      }

      // Find cart by MongoDB _id
      const cart = await this.cartRepository.findById(cartIdStr);
      
      if (!cart) {
        res.status(404).json({
          success: false,
          message: 'Cart not found'
        });
        return;
      }

      logger.success(req.user?._id?.toString() || 'anonymous', 'getCartById', `Retrieved cart: ${cartIdStr}`);

      res.status(200).json({
        success: true,
        data: cart,
        message: 'Cart retrieved successfully'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'getCartById', `Failed to get cart: ${error.message}`);
      next(error);
    }
  }

  
  // Merge guest cart with user cart (when user logs in)
  async mergeGuestCart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const guestId = req.cookies?.guest_id; // Get guest ID from cookie
      const userId = req.user?._id?.toString();

      if (!guestId || !userId) {
        res.status(400).json({
          success: false,
          message: 'Guest ID (from cookie) and user authentication are required'
        });
        return;
      }

      // Merge guest cart with user cart
      const mergedCart = await this.cartRepository.mergeGuestCart(guestId, userId);

      if (!mergedCart) {
        res.status(404).json({
          success: false,
          message: 'Guest cart not found'
        });
        return;
      }

      // Clear the guest cookie after successful merge
      res.cookie('guest_id', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        expires: new Date(0) // Set to past date to delete cookie
      });

      logger.success(userId, 'mergeGuestCart', `Merged guest cart ${guestId} with user cart`);

      res.status(200).json({
        success: true,
        data: mergedCart,
        message: 'Guest cart merged successfully'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'mergeGuestCart', `Failed to merge guest cart: ${error.message}`);
      next(error);
    }
  }

  // Validate cart items (check stock availability)
  async validateCart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cart = await this.getOrCreateCart(req);
      const validationResults = [];

      for (const item of cart.items) {
        const product = await this.productRepository.findById(item.productId); // Use MongoDB _id
        
        if (!product) {
          validationResults.push({
            productId: item.productId,
            title: item.title,
            available: false,
            reason: 'Product not found'
          });
        } else if (product.stock < item.quantity) {
          validationResults.push({
            productId: item.productId,
            title: item.title,
            available: false,
            reason: 'Insufficient stock',
            availableStock: product.stock,
            requestedQuantity: item.quantity
          });
        } else {
          validationResults.push({
            productId: item.productId,
            title: item.title,
            available: true,
            currentPrice: product.price,
            stock: product.stock
          });
        }
      }

      const allItemsAvailable = validationResults.every(result => result.available);

      logger.success(req.user?._id?.toString() || 'anonymous', 'validateCart', `Validated cart: ${allItemsAvailable ? 'All items available' : 'Some items unavailable'}`);

      res.status(200).json({
        success: true,
        data: {
          allItemsAvailable,
          validationResults,
          cartTotal: cart.totalAmount
        }
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'validateCart', `Failed to validate cart: ${error.message}`);
      next(error);
    }
  }
}
