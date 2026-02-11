import { Product, ProductModel } from '../models/Product';
import { logger } from '../../utils/logger';

export class ProductRepository {
  // Create a new product
  async create(productData: Partial<Product>): Promise<Product> {
    try {
      const product = new ProductModel(productData);
      return await product.save();
    } catch (error: any) {
      logger.error('ProductRepository', 'create', `Failed to create product: ${error.message}`);
      throw error;
    }
  }

  // Find product by ID (MongoDB _id)
  async findById(id: string): Promise<Product | null> {
    try {
      return await ProductModel.findById(id);
    } catch (error: any) {
      logger.error('ProductRepository', 'findById', `Failed to find product: ${error.message}`);
      throw error;
    }
  }

  // Get all products with pagination
  async findAll(page: number = 1, limit: number = 10, category?: string): Promise<{ products: Product[], total: number }> {
    try {
      const skip = (page - 1) * limit;
      const query: any = {};
      
      if (category) {
        query.category = category;
      }

      const products = await ProductModel.find(query)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      const total = await ProductModel.countDocuments(query);

      return { products, total };
    } catch (error: any) {
      logger.error('ProductRepository', 'findAll', `Failed to get products: ${error.message}`);
      throw error;
    }
  }

  // Update product by ID
  async updateById(id: string, updateData: Partial<Product>): Promise<Product | null> {
    try {
      return await ProductModel.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );
    } catch (error: any) {
      logger.error('ProductRepository', 'updateById', `Failed to update product: ${error.message}`);
      throw error;
    }
  }

  // Update product by SKU
  async updateBySku(sku: string, updateData: Partial<Product>): Promise<Product | null> {
    try {
      return await ProductModel.findOneAndUpdate(
        { sku },
        updateData,
        { new: true, runValidators: true }
      );
    } catch (error: any) {
      logger.error('ProductRepository', 'updateBySku', `Failed to update product: ${error.message}`);
      throw error;
    }
  }

  // Bulk update products
  async bulkUpdate(updates: Array<{ productId: string, updateData: Partial<Product> }>): Promise<{ updated: number, failed: number }> {
    try {
      let updated = 0;
      let failed = 0;

      for (const { productId, updateData } of updates) {
        try {
          // Use MongoDB _id instead of external id
          const result = await this.updateById(productId, updateData);
          if (result) {
            updated++;
          } else {
            failed++;
          }
        } catch (error) {
          failed++;
        }
      }

      return { updated, failed };
    } catch (error: any) {
      logger.error('ProductRepository', 'bulkUpdate', `Failed to bulk update products: ${error.message}`);
      throw error;
    }
  }

  // Delete product by ID
  async deleteById(id: string): Promise<boolean> {
    try {
      const result = await ProductModel.findByIdAndDelete(id);
      return result !== null;
    } catch (error: any) {
      logger.error('ProductRepository', 'deleteById', `Failed to delete product: ${error.message}`);
      throw error;
    }
  }

  // Delete product by product ID (external ID)
  async deleteByProductId(productId: number): Promise<boolean> {
    try {
      const result = await ProductModel.findOneAndDelete({ id: productId });
      return result !== null;
    } catch (error: any) {
      logger.error('ProductRepository', 'deleteByProductId', `Failed to delete product: ${error.message}`);
      throw error;
    }
  }

  // Get products by category (single category - kept for backward compatibility)
  async findByCategory(category: string, page: number = 1, limit: number = 10): Promise<{ products: Product[], total: number }> {
    try {
      return await this.findAll(page, limit, category);
    } catch (error: any) {
      logger.error('ProductRepository', 'findByCategory', `Failed to get products by category: ${error.message}`);
      throw error;
    }
  }

  // Get products by multiple categories
  async findByCategories(categories: string[], page: number = 1, limit: number = 10): Promise<{ products: Product[], total: number }> {
    try {
      const skip = (page - 1) * limit;
      const query = {
        category: { $in: categories }
      };

      const products = await ProductModel.find(query)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      const total = await ProductModel.countDocuments(query);

      return { products, total };
    } catch (error: any) {
      logger.error('ProductRepository', 'findByCategories', `Failed to get products by categories: ${error.message}`);
      throw error;
    }
  }

  // Search products
  async search(query: string, page: number = 1, limit: number = 10): Promise<{ products: Product[], total: number }> {
    try {
      const skip = (page - 1) * limit;
      const searchRegex = new RegExp(query, 'i');

      const products = await ProductModel.find({
        $or: [
          { title: { $regex: searchRegex } },
          { description: { $regex: searchRegex } },
          { category: { $regex: searchRegex } },
          { tags: { $in: [searchRegex] } }
        ]
      })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      const total = await ProductModel.countDocuments({
        $or: [
          { title: { $regex: searchRegex } },
          { description: { $regex: searchRegex } },
          { category: { $regex: searchRegex } },
          { tags: { $in: [searchRegex] } }
        ]
      });

      return { products, total };
    } catch (error: any) {
      logger.error('ProductRepository', 'search', `Failed to search products: ${error.message}`);
      throw error;
    }
  }

  // Get all categories
  async getCategories(): Promise<string[]> {
    try {
      const categories = await ProductModel.distinct('category');
      return categories;
    } catch (error: any) {
      logger.error('ProductRepository', 'getCategories', `Failed to get categories: ${error.message}`);
      throw error;
    }
  }

  // Check if product exists
  async exists(productId: number): Promise<boolean> {
    try {
      const product = await ProductModel.findOne({ id: productId });
      return product !== null;
    } catch (error: any) {
      logger.error('ProductRepository', 'exists', `Failed to check product existence: ${error.message}`);
      throw error;
    }
  }

  // Get product count
  async getCount(): Promise<number> {
    try {
      return await ProductModel.countDocuments();
    } catch (error: any) {
      logger.error('ProductRepository', 'getCount', `Failed to get product count: ${error.message}`);
      throw error;
    }
  }
}
