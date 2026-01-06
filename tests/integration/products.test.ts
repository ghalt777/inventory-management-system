import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../../src/server';
import { Product } from '../../src/models/Product';

describe('Products API', () => {
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
  });

  describe('POST /products', () => {
    it('should create a new product', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        stock: 10,
        category: 'Electronics',
      };

      const response = await request(app).post('/products').send(productData).expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.name).toBe(productData.name);
      expect(response.body.description).toBe(productData.description);
      expect(response.body.price).toBe(productData.price);
      expect(response.body.stock).toBe(productData.stock);
      expect(response.body.category).toBe(productData.category);
    });

    it('should reject product with missing required fields', async () => {
      const response = await request(app)
        .post('/products')
        .send({ name: 'Test Product' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject product with negative price', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test Description',
        price: -10,
        stock: 10,
        category: 'Electronics',
      };

      const response = await request(app).post('/products').send(productData).expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject product with name/description longer than 50 characters', async () => {
      const productData = {
        name: 'A'.repeat(51),
        description: 'Test Description',
        price: 99.99,
        stock: 10,
        category: 'Electronics',
      };

      const response = await request(app).post('/products').send(productData).expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject product with negative stock', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        stock: -5,
        category: 'Electronics',
      };

      const response = await request(app).post('/products').send(productData).expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /products', () => {
    it('should return an empty array when no products exist', async () => {
      const response = await request(app).get('/products').expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return all products', async () => {
      await Product.create([
        {
          name: 'Product 1',
          description: 'Description 1',
          price: 10,
          stock: 5,
          category: 'Electronics',
        },
        {
          name: 'Product 2',
          description: 'Description 2',
          price: 20,
          stock: 10,
          category: 'Home',
        },
      ]);

      const response = await request(app).get('/products').expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBeDefined();
    });
  });

  describe('GET /products/:id', () => {
    it('should return a product by id', async () => {
      const product = await Product.create({
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        stock: 10,
        category: 'Electronics',
      });

      const response = await request(app).get(`/products/${product._id}`).expect(200);

      expect(response.body._id).toBe(product._id.toString());
      expect(response.body.name).toBe(product.name);
    });

    it('should return 404 for non-existent product', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app).get(`/products/${fakeId}`).expect(404);
    });

    it('should return 400 for invalid product id', async () => {
      await request(app).get('/products/invalid-id').expect(400);
    });
  });

  describe('POST /products/:id/restock', () => {
    it('should increase product stock', async () => {
      const product = await Product.create({
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        stock: 10,
        category: 'Electronics',
      });

      const response = await request(app)
        .post(`/products/${product._id}/restock`)
        .send({ quantity: 5 })
        .expect(200);

      expect(response.body.stock).toBe(15);
    });

    it('should reject negative quantity', async () => {
      const product = await Product.create({
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        stock: 10,
        category: 'Electronics',
      });

      await request(app)
        .post(`/products/${product._id}/restock`)
        .send({ quantity: -5 })
        .expect(400);
    });

    it('should return 404 for non-existent product', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app).post(`/products/${fakeId}/restock`).send({ quantity: 5 }).expect(404);
    });
  });

  describe('POST /products/:id/sell', () => {
    it('should decrease product stock', async () => {
      const product = await Product.create({
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        stock: 10,
        category: 'Electronics',
      });

      const response = await request(app)
        .post(`/products/${product._id}/sell`)
        .send({ quantity: 3 })
        .expect(200);

      expect(response.body.stock).toBe(7);
    });

    it('should prevent stock from going below zero', async () => {
      const product = await Product.create({
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        stock: 5,
        category: 'Electronics',
      });

      const response = await request(app)
        .post(`/products/${product._id}/sell`)
        .send({ quantity: 10 })
        .expect(400);

      expect(response.body.error).toContain('Insufficient stock');
    });

    it('should allow selling exact stock amount', async () => {
      const product = await Product.create({
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        stock: 5,
        category: 'Electronics',
      });

      const response = await request(app)
        .post(`/products/${product._id}/sell`)
        .send({ quantity: 5 })
        .expect(200);

      expect(response.body.stock).toBe(0);
    });
  });
});

