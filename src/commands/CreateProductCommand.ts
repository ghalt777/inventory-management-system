import { Product, IProduct } from '../models/Product';
import { logger } from '../config/logger';

export interface CreateProductDto {
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
}

export class CreateProductCommand {
  async execute(dto: CreateProductDto): Promise<IProduct> {
    logger.debug('Creating product', { name: dto.name, category: dto.category });
    
    const product = new Product(dto);
    await product.save();
    return product;
  }
}

