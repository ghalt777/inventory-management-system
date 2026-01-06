# Inventory Management System (IMS)

A RESTful API for managing product inventory and orders, built with Node.js, Express, TypeScript, and MongoDB. Implements the CQRS pattern and includes sophisticated discount calculation logic.

## Features

- **Product Management**: CRUD operations for products with stock tracking
- **Stock Management**: Restock and sell operations with validation
- **Order Processing**: Create orders with automatic stock updates
- **Discount System**: 
  - Volume-based discounts (10%, 20%, 30%)
  - Seasonal discounts (Black Friday 25%, Polish holidays 15%)
  - Location-based pricing (US, Europe, Asia)
- **CQRS Pattern**: Separated command and query handlers
- **Comprehensive Testing**: Unit and integration tests
- **Type Safety**: Full TypeScript implementation

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (v4.0 or higher)
- npm or yarn

## Installation

1. **Clone the repository**:
```bash
git clone https://github.com/ghalt777/inventory-management-system.git
cd ims
```

2. **Install dependencies**:
```bash
npm install
```

3. **Set up environment variables**:

Create a `.env` file in the root directory:

```env
MONGODB_URI=mongodb://localhost:27017/ims
PORT=3000
NODE_ENV=development
```

4. **Start MongoDB**:

```bash
# Simple standalone instance
mongod --dbpath /path/to/data
```

Alternatively, use Docker:

```bash
docker run -d -p 27017:27017 --name mongodb mongo:7
```

## Running the Application

### Development Mode (with hot reload):
```bash
npm run dev
```

### Build and Run Production:
```bash
npm run build
npm start
```

### Run Tests:
```bash
# Run all tests
npm test

# Run with coverage
npm test:coverage

# Watch mode
npm test:watch
```

### Linting and Formatting:
```bash
npm run lint
npm run format
```

## API Documentation

Base URL: `http://localhost:3000`

### Products Endpoints

#### 1. Get All Products
```http
GET /products
```

**Response**: `200 OK`
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Laptop",
    "description": "High-performance laptop",
    "price": 999.99,
    "stock": 50,
    "category": "Electronics",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
]
```

#### 2. Get Product by ID
```http
GET /products/:id
```

**Response**: `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "Laptop",
  "description": "High-performance laptop",
  "price": 999.99,
  "stock": 50,
  "category": "Electronics"
}
```

**Error Responses**:
- `404 Not Found`: Product not found
- `400 Bad Request`: Invalid product ID format

#### 3. Create Product
```http
POST /products
Content-Type: application/json
```

**Request Body**:
```json
{
  "name": "Laptop",
  "description": "High-performance laptop",
  "price": 999.99,
  "stock": 50,
  "category": "Electronics"
}
```

**Validation Rules**:
- `name`: required, max 50 characters
- `description`: required, max 50 characters
- `price`: required, positive number
- `stock`: required, non-negative integer
- `category`: required

**Response**: `201 Created`
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "Laptop",
  "description": "High-performance laptop",
  "price": 999.99,
  "stock": 50,
  "category": "Electronics",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

**Error Response**: `400 Bad Request`
```json
{
  "error": "Validation Error",
  "message": "\"price\" must be a positive number",
  "details": [...]
}
```

#### 4. Restock Product
```http
POST /products/:id/restock
Content-Type: application/json
```

**Request Body**:
```json
{
  "quantity": 20
}
```

**Response**: `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "Laptop",
  "stock": 70,
  ...
}
```

#### 5. Sell Product
```http
POST /products/:id/sell
Content-Type: application/json
```

**Request Body**:
```json
{
  "quantity": 5
}
```

**Response**: `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "Laptop",
  "stock": 45,
  ...
}
```

**Error Response**: `400 Bad Request`
```json
{
  "error": "Insufficient stock. Available: 45, Requested: 50"
}
```

### Orders Endpoint

#### Create Order
```http
POST /orders
Content-Type: application/json
```

**Request Body**:
```json
{
  "customerId": "customer123",
  "customerLocation": "US",
  "products": [
    {
      "productId": "507f1f77bcf86cd799439011",
      "quantity": 2
    },
    {
      "productId": "507f1f77bcf86cd799439012",
      "quantity": 3
    }
  ]
}
```

**Validation Rules**:
- `customerId`: required, string
- `customerLocation`: required, one of `US`, `Europe`, `Asia`
- `products`: required, array with at least 1 item
  - `productId`: required, valid MongoDB ObjectId
  - `quantity`: required, positive integer

**Response**: `201 Created`
```json
{
  "_id": "507f1f77bcf86cd799439020",
  "customerId": "customer123",
  "customerLocation": "US",
  "products": [
    {
      "productId": "507f1f77bcf86cd799439011",
      "quantity": 2,
      "price": 999.99,
      "name": "Laptop"
    }
  ],
  "subtotal": 1999.98,
  "locationMultiplier": 1.0,
  "adjustedSubtotal": 1999.98,
  "appliedDiscount": {
    "type": "none",
    "percentage": 0,
    "amount": 0
  },
  "totalAmount": 1999.98,
  "orderDate": "2024-01-15T14:30:00.000Z",
  "createdAt": "2024-01-15T14:30:00.000Z",
  "updatedAt": "2024-01-15T14:30:00.000Z"
}
```

**Discount Examples**:

*Volume Discount (10 units):*
```json
{
  "subtotal": 1000.00,
  "adjustedSubtotal": 1000.00,
  "appliedDiscount": {
    "type": "volume",
    "percentage": 20,
    "amount": 200.00
  },
  "totalAmount": 800.00
}
```

*Location Pricing (Europe):*
```json
{
  "subtotal": 1000.00,
  "locationMultiplier": 1.15,
  "adjustedSubtotal": 1150.00,
  "totalAmount": 1150.00
}
```

*Black Friday Discount:*
```json
{
  "subtotal": 1000.00,
  "adjustedSubtotal": 1000.00,
  "appliedDiscount": {
    "type": "black_friday",
    "percentage": 25,
    "amount": 250.00
  },
  "totalAmount": 750.00
}
```

**Error Responses**:

`400 Bad Request` - Insufficient stock:
```json
{
  "error": "Insufficient stock for product \"Laptop\". Available: 5, Requested: 10"
}
```

`404 Not Found` - Product doesn't exist:
```json
{
  "error": "One or more products not found"
}
```

### Health Check

```http
GET /health
```

**Response**: `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T14:30:00.000Z"
}
```

## Discount Rules

### Volume-Based Discounts
Calculated based on total units across all products in an order:

| Units | Discount |
|-------|----------|
| 5-9   | 10%      |
| 10-49 | 20%      |
| 50+   | 30%      |

### Seasonal Discounts

**Black Friday**: Last Friday of November
- **Discount**: 25% off all products
- **Example**: November 29, 2024

**Polish Bank Holidays**: 15% off selected categories (Electronics, Home)
- New Year's Day (January 1)
- Easter Monday (varies)
- Labour Day (May 1)
- Constitution Day (May 3)
- Corpus Christi (varies, 60 days after Easter)
- Assumption of Mary (August 15)
- All Saints' Day (November 1)
- Independence Day (November 11)
- Christmas (December 25-26)

### Location-Based Pricing
Applied to base price before discounts:

| Location | Multiplier | Reason |
|----------|------------|--------|
| US       | 1.0×       | Standard pricing |
| Europe   | 1.15×      | VAT included |
| Asia     | 0.95×      | Reduced logistics |

### Discount Application Rules

1. **No Stacking**: Only one discount can be applied per order
2. **Best for Customer**: The system automatically selects the highest discount amount
3. **Order of Calculation**:
   - Calculate base subtotal (sum of product prices × quantities)
   - Apply location multiplier → adjusted subtotal
   - Calculate all applicable discounts on adjusted subtotal
   - Select and apply the best discount
   - Final total = adjusted subtotal - discount amount

## Project Structure

```
ims/
├── src/
│   ├── commands/              # Write operations (CQRS)
│   │   ├── CreateProductCommand.ts
│   │   ├── RestockProductCommand.ts
│   │   ├── SellProductCommand.ts
│   │   └── CreateOrderCommand.ts
│   ├── queries/               # Read operations (CQRS)
│   │   ├── GetAllProductsQuery.ts
│   │   └── GetProductByIdQuery.ts
│   ├── models/                # Mongoose schemas
│   │   ├── Product.ts
│   │   └── Order.ts
│   ├── routes/                # Express routes
│   │   ├── products.ts
│   │   └── orders.ts
│   ├── middleware/            # Express middleware
│   │   ├── validateRequest.ts
│   │   └── errorHandler.ts
│   ├── utils/                 # Utilities
│   │   ├── discountCalculator.ts
│   │   └── dateUtils.ts
│   ├── validation/            # Joi schemas
│   │   └── schemas.ts
│   ├── config/                # Configuration
│   │   ├── database.ts
│   │   └── env.ts
│   └── server.ts              # Entry point
├── tests/
│   ├── unit/                  # Unit tests
│   │   ├── discountCalculator.test.ts
│   │   └── dateUtils.test.ts
│   └── integration/           # Integration tests
│       ├── products.test.ts
│       └── orders.test.ts
├── .env                       # Environment variables (not in git)
├── .gitignore
├── package.json
├── tsconfig.json
├── jest.config.js
├── README.md
└── NOTES.md                   # Development notes and decisions
```

## Testing

The project includes comprehensive test coverage:

### Unit Tests
- **Discount Calculator**: Volume discounts, seasonal discounts, location pricing, best discount selection
- **Date Utilities**: Black Friday detection, Polish holiday detection, Easter calculation

### Integration Tests
- **Products API**: CRUD operations, validation, stock management
- **Orders API**: Order creation, discount application, stock updates, error handling

### Run Tests
```bash
# All tests
npm test

# With coverage report
npm test:coverage

# Watch mode for development
npm test:watch
```

### Coverage
Current test coverage focuses on:
- Business logic (discount calculation, stock management)
- API endpoints (validation, error handling)
- Edge cases (exact stock depletion, insufficient stock, invalid inputs)

See `NOTES.md` section 4 for detailed testing documentation.

## Error Handling

The API returns consistent error responses:

### Validation Errors (400)
```json
{
  "error": "Validation Error",
  "message": "\"price\" must be a positive number",
  "details": [...]
}
```

### Not Found (404)
```json
{
  "error": "Product not found",
  "statusCode": 404
}
```

### Business Logic Errors (400)
```json
{
  "error": "Insufficient stock for product \"Laptop\". Available: 5, Requested: 10"
}
```

### Server Errors (500)
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

## Development Notes

For detailed information about:
- Assumptions and simplifications
- Technical decisions and rationale
- Business logic implementation
- Testing strategy
- Trade-offs and alternatives

Please see **[NOTES.md](./NOTES.md)**.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/ims` |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment (`development`, `production`) | `development` |

## Technologies Used

- **Runtime**: Node.js v18+
- **Framework**: Express.js 5
- **Language**: TypeScript 5
- **Database**: MongoDB with Mongoose ODM
- **Validation**: Joi
- **Testing**: Jest with ts-jest
- **Date Handling**: date-fns
- **Development**: ts-node, nodemon
- **Code Quality**: ESLint, Prettier

