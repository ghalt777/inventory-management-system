import { Product, IProduct } from '../models/Product';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

export interface SellProductDto {
  productId: string;
  quantity: number;
}

export class SellProductCommand {
  async execute(dto: SellProductDto): Promise<IProduct> {
    logger.debug('Selling product', { productId: dto.productId, quantity: dto.quantity });
    
    const product = await Product.findOneAndUpdate(
      {
        _id: dto.productId,
        stock: { $gte: dto.quantity },
      },
      { $inc: { stock: -dto.quantity } },
      { new: true }
    );

    if (!product) {
      // Check if product exists at all
      const existingProduct = await Product.findById(dto.productId);
      
      if (!existingProduct) {
        throw new AppError('Product not found', 404);
      }
      
      // Product exists but insufficient stock
      throw new AppError(
        `Insufficient stock. Available: ${existingProduct.stock}, Requested: ${dto.quantity}`,
        400
      );
    }

    return product;
  }
}

