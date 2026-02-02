import { Request, Response, NextFunction } from 'express';
import { ProductRepository } from '../repository/ProductRepository';
import { DummyProductService } from '../services/DummyProductService';
import { logger } from '../../utils/logger';

export class ProductController {
  private productRepository: ProductRepository;
  private dummyProductService: DummyProductService;

  constructor() {
    this.productRepository = new ProductRepository();
    this.dummyProductService = new DummyProductService();
  }

  // Get all products with pagination and optional category filter
  async getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const category = req.query.category as string;

      const { products, total } = await this.productRepository.findAll(page, limit, category);

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      logger.success('anonymous', 'getProducts', `Retrieved ${products.length} products (page ${page} of ${totalPages})`);

      res.status(200).json({
        success: true,
        data: products,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords: total,
          recordsPerPage: limit,
          hasNextPage,
          hasPrevPage,
        },
        message: 'Products retrieved successfully'
      });
    } catch (error: any) {
      logger.error('anonymous', 'getProducts', `Failed to get products: ${error.message}`);
      next(error);
    }
  }

  // Get product by ID
  async getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const idStr = Array.isArray(id) ? id[0] : id;

      const product = await this.productRepository.findById(idStr);

      if (!product) {
        res.status(404).json({
          success: false,
          message: 'Product not found'
        });
        return;
      }

      logger.success('anonymous', 'getProductById', `Retrieved product: ${product.title}`);

      res.status(200).json({
        success: true,
        data: product
      });
    } catch (error: any) {
      logger.error('anonymous', 'getProductById', `Failed to get product: ${error.message}`);
      next(error);
    }
  }

  // Search products
  async searchProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q: query } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
        return;
      }

      const { products, total } = await this.productRepository.search(query, page, limit);

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      logger.success('anonymous', 'searchProducts', `Found ${products.length} products for query: ${query} (page ${page} of ${totalPages})`);

      res.status(200).json({
        success: true,
        data: products,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords: total,
          recordsPerPage: limit,
          hasNextPage,
          hasPrevPage,
        },
        message: `Products found for query: ${query}`
      });
    } catch (error: any) {
      logger.error('anonymous', 'searchProducts', `Failed to search products: ${error.message}`);
      next(error);
    }
  }

  // Get products by category
  async getProductsByCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { category } = req.params;
      const categoryStr = Array.isArray(category) ? category[0] : category;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const { products, total } = await this.productRepository.findByCategory(categoryStr, page, limit);

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      logger.success('anonymous', 'getProductsByCategory', `Retrieved ${products.length} products for category: ${categoryStr} (page ${page} of ${totalPages})`);

      res.status(200).json({
        success: true,
        data: products,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords: total,
          recordsPerPage: limit,
          hasNextPage,
          hasPrevPage,
        },
        message: `Products retrieved successfully for category: ${categoryStr}`
      });
    } catch (error: any) {
      logger.error('anonymous', 'getProductsByCategory', `Failed to get products by category: ${error.message}`);
      next(error);
    }
  }

  // Get all categories
  async getCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await this.productRepository.getCategories();

      logger.success('anonymous', 'getCategories', `Retrieved ${categories.length} categories`);

      res.status(200).json({
        success: true,
        data: categories
      });
    } catch (error: any) {
      logger.error('anonymous', 'getCategories', `Failed to get categories: ${error.message}`);
      next(error);
    }
  }

  // Create a new product (admin only)
  async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productData = req.body;

      // Check if product with same external ID already exists
      if (productData.id) {
        const exists = await this.productRepository.exists(productData.id);
        if (exists) {
          res.status(409).json({
            success: false,
            message: 'Product with this ID already exists'
          });
          return;
        }
      }

      const product = await this.productRepository.create(productData);

      logger.success(req.user?._id?.toString() || 'anonymous', 'createProduct', `Created product: ${product.title}`);

      res.status(201).json({
        success: true,
        data: product,
        message: 'Product created successfully'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'createProduct', `Failed to create product: ${error.message}`);
      next(error);
    }
  }

  // Update product by ID
  async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const idStr = Array.isArray(id) ? id[0] : id;
      const updateData = req.body;

      const product = await this.productRepository.updateById(idStr, updateData);

      if (!product) {
        res.status(404).json({
          success: false,
          message: 'Product not found'
        });
        return;
      }

      logger.success(req.user?._id?.toString() || 'anonymous', 'updateProduct', `Updated product: ${product.title}`);

      res.status(200).json({
        success: true,
        data: product,
        message: 'Product updated successfully'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'updateProduct', `Failed to update product: ${error.message}`);
      next(error);
    }
  }

  // Bulk update products
  async bulkUpdateProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { updates } = req.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Updates array is required'
        });
        return;
      }

      const result = await this.productRepository.bulkUpdate(updates);

      logger.success(req.user?._id?.toString() || 'anonymous', 'bulkUpdateProducts', `Bulk updated: ${result.updated} products, ${result.failed} failed`);

      res.status(200).json({
        success: true,
        data: result,
        message: `Bulk update completed: ${result.updated} updated, ${result.failed} failed`
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'bulkUpdateProducts', `Failed to bulk update products: ${error.message}`);
      next(error);
    }
  }

  // Delete product by ID
  async deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const idStr = Array.isArray(id) ? id[0] : id;

      const deleted = await this.productRepository.deleteById(idStr);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Product not found'
        });
        return;
      }

      logger.success(req.user?._id?.toString() || 'anonymous', 'deleteProduct', `Deleted product with ID: ${id}`);

      res.status(200).json({
        success: true,
        message: 'Product deleted successfully'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'deleteProduct', `Failed to delete product: ${error.message}`);
      next(error);
    }
  }

  // Fetch and store products from dummy API
  async fetchAndStoreProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 30;

      const result = await this.dummyProductService.fetchAndStoreProducts(limit);

      logger.success(req.user?._id?.toString() || 'anonymous', 'fetchAndStoreProducts', `Fetched and stored: ${result.fetched} fetched, ${result.stored} stored, ${result.skipped} skipped, ${result.failed} failed`);

      res.status(200).json({
        success: true,
        data: result,
        message: `Products fetched and stored successfully: ${result.stored} new products added`
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'fetchAndStoreProducts', `Failed to fetch and store products: ${error.message}`);
      next(error);
    }
  }

  // Update existing products from dummy API
  async updateExistingProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 30;

      const result = await this.dummyProductService.updateExistingProducts(limit);

      logger.success(req.user?._id?.toString() || 'anonymous', 'updateExistingProducts', `Updated existing products: ${result.updated} updated, ${result.failed} failed`);

      res.status(200).json({
        success: true,
        data: result,
        message: `Products updated successfully: ${result.updated} updated`
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'updateExistingProducts', `Failed to update existing products: ${error.message}`);
      next(error);
    }
  }

  // Get product statistics
  async getProductStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const totalProducts = await this.productRepository.getCount();
      const categories = await this.productRepository.getCategories();

      const stats = {
        totalProducts,
        totalCategories: categories.length,
        categories
      };

      logger.success('anonymous', 'getProductStats', `Retrieved product stats: ${totalProducts} products, ${categories.length} categories`);

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      logger.error('anonymous', 'getProductStats', `Failed to get product stats: ${error.message}`);
      next(error);
    }
  }
}
