import { Product, IProduct } from '../models/Product';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

export interface RestockProductDto {
  productId: string;
  quantity: number;
}

export class RestockProductCommand {
  async execute(dto: RestockProductDto): Promise<IProduct> {
    logger.debug('Restocking product', { productId: dto.productId, quantity: dto.quantity });
    
    const product = await Product.findByIdAndUpdate(
      dto.productId,
      { $inc: { stock: dto.quantity } },
      { new: true }
    );

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    return product;
  }
}

