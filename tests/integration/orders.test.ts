import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../../src/server';
import { Product } from '../../src/models/Product';
import { Order } from '../../src/models/Order';
import * as dateUtils from '../../src/utils/dateUtils';

describe('Orders API', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await Product.deleteMany({});
    await Order.deleteMany({});
  });

  describe('POST /orders', () => {
    it('should create an order with no discount', async () => {
      const product = await Product.create({
        name: 'Test Product',
        description: 'Test Description',
        price: 100,
        stock: 10,
        category: 'Other',
      });

      const orderData = {
        customerId: 'customer123',
        customerLocation: 'US',
        products: [{ productId: product._id.toString(), quantity: 2 }],
      };

      const response = await request(app).post('/orders').send(orderData).expect(201);

      expect(response.body.customerId).toBe('customer123');
      expect(response.body.subtotal).toBe(200);
      expect(response.body.locationMultiplier).toBe(1.0);
      expect(response.body.adjustedSubtotal).toBe(200);
      expect(response.body.appliedDiscount.type).toBe('none');
      expect(response.body.totalAmount).toBe(200);

      // Check stock was decreased
      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct?.stock).toBe(8);
    });

    it('should apply volume discount for 5-9 units', async () => {
      const product = await Product.create({
        name: 'Test Product',
        description: 'Test Description',
        price: 100,
        stock: 20,
        category: 'Other',
      });

      const orderData = {
        customerId: 'customer123',
        customerLocation: 'US',
        products: [{ productId: product._id.toString(), quantity: 5 }],
      };

      const response = await request(app).post('/orders').send(orderData).expect(201);

      expect(response.body.subtotal).toBe(500);
      expect(response.body.appliedDiscount.type).toBe('volume');
      expect(response.body.appliedDiscount.percentage).toBe(10);
      expect(response.body.totalAmount).toBe(450); // 500 - 50
    });

    it('should apply volume discount for 10-49 units', async () => {
      const product = await Product.create({
        name: 'Test Product',
        description: 'Test Description',
        price: 100,
        stock: 50,
        category: 'Other',
      });

      const orderData = {
        customerId: 'customer123',
        customerLocation: 'US',
        products: [{ productId: product._id.toString(), quantity: 10 }],
      };

      const response = await request(app).post('/orders').send(orderData).expect(201);

      expect(response.body.appliedDiscount.type).toBe('volume');
      expect(response.body.appliedDiscount.percentage).toBe(20);
      expect(response.body.totalAmount).toBe(800); // 1000 - 200
    });

    it('should apply volume discount for 50+ units', async () => {
      const product = await Product.create({
        name: 'Test Product',
        description: 'Test Description',
        price: 100,
        stock: 100,
        category: 'Other',
      });

      const orderData = {
        customerId: 'customer123',
        customerLocation: 'US',
        products: [{ productId: product._id.toString(), quantity: 50 }],
      };

      const response = await request(app).post('/orders').send(orderData).expect(201);

      expect(response.body.appliedDiscount.type).toBe('volume');
      expect(response.body.appliedDiscount.percentage).toBe(30);
      expect(response.body.totalAmount).toBe(3500); // 5000 - 1500
    });

    it('should apply location pricing for Europe', async () => {
      const product = await Product.create({
        name: 'Test Product',
        description: 'Test Description',
        price: 100,
        stock: 10,
        category: 'Other',
      });

      const orderData = {
        customerId: 'customer123',
        customerLocation: 'Europe',
        products: [{ productId: product._id.toString(), quantity: 2 }],
      };

      const response = await request(app).post('/orders').send(orderData).expect(201);

      expect(response.body.subtotal).toBe(200);
      expect(response.body.locationMultiplier).toBe(1.15);
      expect(response.body.adjustedSubtotal).toBeCloseTo(230, 2);
      expect(response.body.totalAmount).toBeCloseTo(230, 2);
    });

    it('should apply location pricing for Asia', async () => {
      const product = await Product.create({
        name: 'Test Product',
        description: 'Test Description',
        price: 100,
        stock: 10,
        category: 'Other',
      });

      const orderData = {
        customerId: 'customer123',
        customerLocation: 'Asia',
        products: [{ productId: product._id.toString(), quantity: 2 }],
      };

      const response = await request(app).post('/orders').send(orderData).expect(201);

      expect(response.body.subtotal).toBe(200);
      expect(response.body.locationMultiplier).toBe(0.95);
      expect(response.body.adjustedSubtotal).toBe(190);
      expect(response.body.totalAmount).toBe(190);
    });

    it('should handle multiple products in one order', async () => {
      const product1 = await Product.create({
        name: 'Product 1',
        description: 'Description 1',
        price: 100,
        stock: 10,
        category: 'Electronics',
      });

      const product2 = await Product.create({
        name: 'Product 2',
        description: 'Description 2',
        price: 50,
        stock: 10,
        category: 'Home',
      });

      const orderData = {
        customerId: 'customer123',
        customerLocation: 'US',
        products: [
          { productId: product1._id.toString(), quantity: 2 },
          { productId: product2._id.toString(), quantity: 3 },
        ],
      };

      const response = await request(app).post('/orders').send(orderData).expect(201);

      // Subtotal: (2 * 100) + (3 * 50) = 350
      // Total units: 5 -> 10% volume discount
      expect(response.body.subtotal).toBe(350);
      expect(response.body.appliedDiscount.percentage).toBe(10);
      expect(response.body.totalAmount).toBe(315); // 350 - 35
    });

    it('should prevent order when stock is insufficient', async () => {
      const product = await Product.create({
        name: 'Test Product',
        description: 'Test Description',
        price: 100,
        stock: 5,
        category: 'Other',
      });

      const orderData = {
        customerId: 'customer123',
        customerLocation: 'US',
        products: [{ productId: product._id.toString(), quantity: 10 }],
      };

      const response = await request(app).post('/orders').send(orderData).expect(400);

      expect(response.body.error).toContain('Insufficient stock');

      // Stock should remain unchanged
      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct?.stock).toBe(5);
    });

    it('should return 404 when product does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const orderData = {
        customerId: 'customer123',
        customerLocation: 'US',
        products: [{ productId: fakeId.toString(), quantity: 1 }],
      };

      await request(app).post('/orders').send(orderData).expect(404);
    });

    it('should reject invalid customer location', async () => {
      const product = await Product.create({
        name: 'Test Product',
        description: 'Test Description',
        price: 100,
        stock: 10,
        category: 'Other',
      });

      const orderData = {
        customerId: 'customer123',
        customerLocation: 'InvalidLocation',
        products: [{ productId: product._id.toString(), quantity: 2 }],
      };

      await request(app).post('/orders').send(orderData).expect(400);
    });

    it('should reject order with empty products array', async () => {
      const orderData = {
        customerId: 'customer123',
        customerLocation: 'US',
        products: [],
      };

      await request(app).post('/orders').send(orderData).expect(400);
    });
  });

  describe('POST /orders - Seasonal Discounts', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should apply Black Friday discount (25%)', async () => {
      // Mock getDiscountType to return black_friday
      jest.spyOn(dateUtils, 'getDiscountType').mockReturnValue('black_friday');

      const product = await Product.create({
        name: 'Test Product',
        description: 'Test Description',
        price: 100,
        stock: 10,
        category: 'Electronics',
      });

      const orderData = {
        customerId: 'customer123',
        customerLocation: 'US',
        products: [{ productId: product._id.toString(), quantity: 2 }],
      };

      const response = await request(app).post('/orders').send(orderData).expect(201);

      expect(response.body.subtotal).toBe(200);
      expect(response.body.appliedDiscount.type).toBe('black_friday');
      expect(response.body.appliedDiscount.percentage).toBe(25);
      expect(response.body.totalAmount).toBe(150); // 200 - 50
    });

    it('should apply holiday discount for eligible categories (15%)', async () => {
      // Mock getDiscountType to return holiday
      jest.spyOn(dateUtils, 'getDiscountType').mockReturnValue('holiday');

      const product = await Product.create({
        name: 'Test Electronics',
        description: 'Test Description',
        price: 100,
        stock: 10,
        category: 'Electronics', // Eligible category
      });

      const orderData = {
        customerId: 'customer123',
        customerLocation: 'US',
        products: [{ productId: product._id.toString(), quantity: 2 }],
      };

      const response = await request(app).post('/orders').send(orderData).expect(201);

      expect(response.body.subtotal).toBe(200);
      expect(response.body.appliedDiscount.type).toBe('holiday');
      expect(response.body.appliedDiscount.percentage).toBe(15);
      expect(response.body.totalAmount).toBe(170); // 200 - 30
    });

    it('should not apply holiday discount for non-eligible categories', async () => {
      // Mock getDiscountType to return holiday (but category is not eligible)
      jest.spyOn(dateUtils, 'getDiscountType').mockReturnValue('holiday');

      const product = await Product.create({
        name: 'Test Product',
        description: 'Test Description',
        price: 100,
        stock: 10,
        category: 'Other', // Non-eligible category
      });

      const orderData = {
        customerId: 'customer123',
        customerLocation: 'US',
        products: [{ productId: product._id.toString(), quantity: 2 }],
      };

      const response = await request(app).post('/orders').send(orderData).expect(201);

      expect(response.body.subtotal).toBe(200);
      expect(response.body.appliedDiscount.type).toBe('none');
      expect(response.body.totalAmount).toBe(200);
    });

    it('should choose Black Friday over volume discount when better', async () => {
      // Mock getDiscountType to return black_friday
      jest.spyOn(dateUtils, 'getDiscountType').mockReturnValue('black_friday');

      const product = await Product.create({
        name: 'Test Product',
        description: 'Test Description',
        price: 100,
        stock: 20,
        category: 'Electronics',
      });

      const orderData = {
        customerId: 'customer123',
        customerLocation: 'US',
        products: [{ productId: product._id.toString(), quantity: 5 }], // Qualifies for 10% volume discount
      };

      const response = await request(app).post('/orders').send(orderData).expect(201);

      expect(response.body.subtotal).toBe(500);
      expect(response.body.appliedDiscount.type).toBe('black_friday');
      expect(response.body.appliedDiscount.percentage).toBe(25); // Better than 10% volume
      expect(response.body.totalAmount).toBe(375); // 500 - 125
    });

    it('should apply holiday discount with location pricing', async () => {
      // Mock getDiscountType to return holiday
      jest.spyOn(dateUtils, 'getDiscountType').mockReturnValue('holiday');

      const product = await Product.create({
        name: 'Test Home Product',
        description: 'Test Description',
        price: 100,
        stock: 10,
        category: 'Home', // Eligible category
      });

      const orderData = {
        customerId: 'customer123',
        customerLocation: 'Europe',
        products: [{ productId: product._id.toString(), quantity: 2 }],
      };

      const response = await request(app).post('/orders').send(orderData).expect(201);

      // Subtotal: 200, Location adjusted: 230 (1.15x), Holiday discount: 15% off 230
      expect(response.body.subtotal).toBe(200);
      expect(response.body.locationMultiplier).toBe(1.15);
      expect(response.body.adjustedSubtotal).toBeCloseTo(230, 2);
      expect(response.body.appliedDiscount.type).toBe('holiday');
      expect(response.body.totalAmount).toBeCloseTo(195.5, 2); // 230 - 34.5
    });
  });

  describe('POST /orders - Concurrent Operations', () => {
    it('should handle concurrent orders correctly with atomic operations', async () => {
      const product = await Product.create({
        name: 'Limited Stock Product',
        description: 'Test Description',
        price: 100,
        stock: 8, // Only 8 items available
        category: 'Electronics',
      });

      const orderData = {
        customerId: 'customer123',
        customerLocation: 'US',
        products: [{ productId: product._id.toString(), quantity: 5 }],
      };

      // Simulate two concurrent orders trying to buy 5 items each
      // Only one should succeed since 5 + 5 > 8
      const [response1, response2] = await Promise.all([
        request(app).post('/orders').send(orderData),
        request(app).post('/orders').send(orderData),
      ]);

      // One should succeed (201), one should fail (400)
      const statuses = [response1.status, response2.status].sort();
      expect(statuses).toEqual([201, 400]);

      // The failed one should have insufficient stock error
      const failedResponse = response1.status === 400 ? response1 : response2;
      expect(failedResponse.body.error).toContain('Insufficient stock');

      // Final stock should be 3 (8 - 5)
      const finalProduct = await Product.findById(product._id);
      expect(finalProduct?.stock).toBe(3);

      // Exactly one order should be created
      const orders = await Order.find({});
      expect(orders.length).toBe(1);
    });

    it('should handle concurrent sell operations atomically', async () => {
      const product = await Product.create({
        name: 'Test Product',
        description: 'Test Description',
        price: 100,
        stock: 10,
        category: 'Electronics',
      });

      // Simulate 5 concurrent sell requests of 3 items each
      // Total = 15, but only 10 available
      const sellRequests = Array(5).fill(null).map(() =>
        request(app)
          .post(`/products/${product._id}/sell`)
          .send({ quantity: 3 })
      );

      const responses = await Promise.all(sellRequests);

      // Count successes and failures
      const successes = responses.filter(r => r.status === 200).length;
      const failures = responses.filter(r => r.status === 400).length;

      // Should have 3 successes (3x3=9) and 2 failures
      expect(successes).toBe(3);
      expect(failures).toBe(2);

      // Final stock should be 1 (10 - 9)
      const finalProduct = await Product.findById(product._id);
      expect(finalProduct?.stock).toBe(1);
    });

    it('should prevent negative stock in concurrent restock/sell operations', async () => {
      const product = await Product.create({
        name: 'Test Product',
        description: 'Test Description',
        price: 100,
        stock: 5,
        category: 'Electronics',
      });

      // Mix of concurrent operations: sell and restock
      const operations = [
        request(app).post(`/products/${product._id}/sell`).send({ quantity: 3 }),
        request(app).post(`/products/${product._id}/restock`).send({ quantity: 10 }),
        request(app).post(`/products/${product._id}/sell`).send({ quantity: 4 }),
        request(app).post(`/products/${product._id}/sell`).send({ quantity: 2 }),
      ];

      await Promise.all(operations);

      // Final stock should be consistent (never negative)
      const finalProduct = await Product.findById(product._id);
      expect(finalProduct?.stock).toBeGreaterThanOrEqual(0);
    });
  });
});

