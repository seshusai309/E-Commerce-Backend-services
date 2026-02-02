import dotenv from 'dotenv';
import { DummyProductService } from '../products/services/DummyProductService';
import connectDB from '../config/db';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

async function fetchAndStoreProducts() {
  try {
    // Connect to database
    await connectDB();
    logger.success('system', 'fetchProductsScript', 'Database connected successfully');

    // Initialize service
    const dummyProductService = new DummyProductService();

    // Fetch and store products
    console.log('🚀 Starting to fetch and store products from dummy API...');
    const result = await dummyProductService.fetchAndStoreProducts(30);

    console.log('\n Fetch and Store Results:');
    console.log(`Products fetched: ${result.fetched}`);
    console.log(`Products stored: ${result.stored}`);
    console.log(`Products skipped: ${result.skipped}`);
    console.log(`Products failed: ${result.failed}`);

    if (result.stored > 0) {
      console.log('\n Successfully added new products to the database!');
    }

    if (result.skipped > 0) {
      console.log(` ${result.skipped} products were already in the database and were skipped.`);
    }

    if (result.failed > 0) {
      console.log(`  ${result.failed} products failed to store.`);
    }

    console.log('\n Script completed successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error fetching and storing products:', error.message);
    logger.error('system', 'fetchProductsScript', `Script failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
fetchAndStoreProducts();
