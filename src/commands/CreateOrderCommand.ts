import { Order, IOrder, CustomerLocation, IOrderProduct } from '../models/Order';
import { Product } from '../models/Product';
import { AppError } from '../middleware/errorHandler';
import { calculateOrderPricing } from '../utils/discountCalculator';
import { logger } from '../config/logger';

export interface CreateOrderDto {
  customerId: string;
  customerLocation: CustomerLocation;
  products: Array<{
    productId: string;
    quantity: number;
  }>;
}

export class CreateOrderCommand {
  async execute(dto: CreateOrderDto): Promise<IOrder> {
    logger.debug('Creating order', { 
      customerId: dto.customerId, 
      productCount: dto.products.length 
    });
    
    // Fetch all products and validate
    const productIds = dto.products.map((p) => p.productId);
    const products = await Product.find({ _id: { $in: productIds } });

    if (products.length !== dto.products.length) {
      throw new AppError('One or more products not found', 404);
    }

    // Create a map for easy lookup
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    // Validate stock availability and calculate totals
    let baseSubtotal = 0;
    let totalUnits = 0;
    const categories: string[] = [];
    const orderProducts: IOrderProduct[] = [];

    for (const orderProduct of dto.products) {
      const product = productMap.get(orderProduct.productId);

      if (!product) {
        throw new AppError(`Product ${orderProduct.productId} not found`, 404);
      }

      if (product.stock < orderProduct.quantity) {
        throw new AppError(
          `Insufficient stock for product "${product.name}". Available: ${product.stock}, Requested: ${orderProduct.quantity}`,
          400
        );
      }

      baseSubtotal += product.price * orderProduct.quantity;
      totalUnits += orderProduct.quantity;
      if (!categories.includes(product.category)) {
        categories.push(product.category);
      }

      orderProducts.push({
        productId: product._id.toString(),
        quantity: orderProduct.quantity,
        price: product.price,
        name: product.name,
      });
    }

    // Calculate pricing with discounts
    const pricing = calculateOrderPricing(
      baseSubtotal,
      totalUnits,
      dto.customerLocation,
      categories
    );

    // Update stock levels atomically
    // Using findOneAndUpdate with version check for each product
    for (const orderProduct of dto.products) {
      const result = await Product.findOneAndUpdate(
        {
          _id: orderProduct.productId,
          stock: { $gte: orderProduct.quantity },
        },
        { $inc: { stock: -orderProduct.quantity } },
        { new: true }
      );

      // If no document was updated, stock was insufficient (race condition)
      if (!result) {
        throw new AppError(
          `Insufficient stock for product. This may be due to concurrent orders.`,
          400
        );
      }
    }

    // Create order
    const order = new Order({
      customerId: dto.customerId,
      customerLocation: dto.customerLocation,
      products: orderProducts,
      subtotal: pricing.subtotal,
      locationMultiplier: pricing.locationMultiplier,
      adjustedSubtotal: pricing.adjustedSubtotal,
      appliedDiscount: pricing.appliedDiscount,
      totalAmount: pricing.totalAmount,
      orderDate: new Date(),
    });

    await order.save();

    return order;
  }
}

