import { Product, IProduct } from '../models/Product';
import { logger } from '../config/logger';

export class GetAllProductsQuery {
  async execute(): Promise<IProduct[]> {
    logger.debug('Fetching all products');
    return await Product.find().sort({ createdAt: -1 });
  }
}

