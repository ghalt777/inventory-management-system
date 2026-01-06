import { Product, IProduct } from '../models/Product';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

export class GetProductByIdQuery {
  async execute(productId: string): Promise<IProduct> {
    logger.debug('Fetching product by ID', { productId });
    const product = await Product.findById(productId);

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    return product;
  }
}

