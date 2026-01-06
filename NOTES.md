# Development Notes

## 1. Assumptions & Simplifications

### Customer Model
- **Simplified Customer Entity**: No dedicated customer database or entity is implemented. The `customerId` is passed as a string in the order request and stored directly in the order document.
- **Rationale**: This simplification allows focus on the core inventory and order management logic. In a production system, we would have a separate Customer collection with authentication, profiles, and order history.

### Location-Based Pricing
- **Static Location Parameter**: Customer location is passed explicitly in the order request rather than being derived from IP geolocation or customer profile.
- **Rationale**: This simplifies the implementation while still demonstrating the location-based pricing logic. In production, location would be stored in the customer profile or determined via IP-based geolocation services.

### Holiday Sales Categories
- **Fixed Eligible Categories**: Holiday discounts apply only to two predefined categories: "Electronics" and "Home".
- **Rationale**: The task specification requested "selected product categories (choose two)". This hardcoded approach is simple and sufficient for the scope of this project.

### Bank Holidays
- **Polish Bank Holidays as Reference**: All seasonal holiday sales are based on Polish bank holidays as specified in the task requirements.
- **Included Holidays**:
  - Fixed dates: New Year (Jan 1), Labour Day (May 1), Constitution Day (May 3), Assumption of Mary (Aug 15), All Saints (Nov 1), Independence Day (Nov 11), Christmas (Dec 25-26)
  - Variable dates: Easter Monday (Easter + 1 day), Corpus Christi (Easter + 60 days)
- **Implementation**: Easter calculation uses the Anonymous Gregorian algorithm for accuracy across years.

### Black Friday
- **Definition**: Implemented as the last Friday of November each year.
- **Discount**: 25% off all products, regardless of category.

### Authentication & Authorization
- **Not Implemented**: No authentication or authorization mechanisms are included.
- **Rationale**: The task specification did not require authentication. In production, we would implement JWT-based authentication, role-based access control (RBAC), and customer-specific permissions.

### Timezone Handling
- **Simplified**: All dates use the server's timezone (system default).
- **Consideration**: In production, we would need to consider customer timezones, especially for Black Friday (which day exactly?) and holiday sales across different regions.

## 2. Technical Decisions

### Database Choice: MongoDB with Mongoose

**Why MongoDB?**
- **Flexible Schema**: Products can have varying attributes (e.g., different categories with different metadata) without rigid schema constraints.
- **JSON-like Documents**: Natural fit for JavaScript/TypeScript development and API responses.
- **Easy Aggregations**: MongoDB's aggregation pipeline makes it easy to calculate order statistics, revenue reports, etc.
- **Horizontal Scalability**: Good for future scaling needs.

**Why Mongoose?**
- **Schema Validation**: Mongoose provides schema validation at the application level, ensuring data integrity.
- **Type Safety**: Works well with TypeScript for compile-time type checking.
- **Middleware Hooks**: Useful for pre/post-save logic if needed in the future.
- **Connection Management**: Simplifies connection pooling and error handling.

**Alternative Considered**: Native MongoDB driver with manual validation. Rejected because Mongoose provides better developer experience and type safety.

### CQRS Pattern Implementation

**Approach**:
- **Command Handlers** (`src/commands/`): Handle all write operations (create, update, delete). Each command is a class with an `execute()` method that encapsulates business logic.
- **Query Handlers** (`src/queries/`): Handle all read operations. Separated from commands to allow independent optimization and scaling.
- **Benefits**:
  - Clear separation of concerns
  - Easier to test individual commands/queries
  - Future-ready for event sourcing or separate read/write databases
  - Better code organization and maintainability

**Why Not Full Event Sourcing?**
- Event sourcing adds significant complexity (event store, replay mechanisms, projections)
- Overkill for the current scope and requirements
- Simple CQRS pattern provides most benefits without the overhead

### Project Structure

```
src/
  commands/          # Write operations (CreateOrder, SellProduct, etc.)
  queries/           # Read operations (GetAllProducts, GetProductById)
  models/            # Mongoose schemas (Product, Order)
  routes/            # Express route handlers
  middleware/        # Validation, error handling
  utils/             # Discount calculator, date utilities
  config/            # Database connection, environment config
  server.ts          # Express app entry point
tests/
  unit/              # Unit tests for business logic
  integration/       # API integration tests with MongoDB Memory Server
```

**Rationale**:
- Mirrors CQRS boundaries at the file system level
- Easy to locate code by functionality
- Scalable: new features can be added by creating new commands/queries
- Clear separation between business logic (commands/queries), infrastructure (config, middleware), and presentation (routes)

### Validation Strategy

**Joi for Request Validation**:
- Declarative schema definition
- Rich validation rules (required, min/max, custom validators)
- Detailed error messages
- Middleware pattern for clean route handlers

**Mongoose for Data Validation**:
- Second layer of validation at the database level
- Prevents invalid data even if validation middleware is bypassed
- Type coercion and sanitization

**Alternative Considered**: Zod (already installed in the project). Rejected in favor of Joi because Joi is more established for Express validation, though Zod would work equally well.

### Error Handling

**Strategy**:
- **Custom `AppError` Class**: For operational errors (e.g., product not found, insufficient stock) with specific HTTP status codes.
- **Global Error Handler Middleware**: Catches all errors and formats consistent JSON responses.
- **Async Handler Wrapper**: Automatically catches async errors and forwards to error middleware.

**Benefits**:
- Consistent error responses across all endpoints
- Clear distinction between operational errors (4xx) and unexpected errors (5xx)
- Proper logging of unexpected errors

## 3. Business Logic

### Discount System

**How It Works**:

1. **Calculate Base Subtotal**: Sum of (product price × quantity) for all products in the order.

2. **Apply Location-Based Pricing**: Multiply base subtotal by location multiplier:
   - US: 1.0× (standard)
   - Europe: 1.15× (VAT)
   - Asia: 0.95× (reduced logistics)
   - This gives us the **adjusted subtotal**.

3. **Calculate All Applicable Discounts**:
   - **Volume Discount**: Based on total units across all products:
     - 5-9 units: 10% off
     - 10-49 units: 20% off
     - 50+ units: 30% off
   - **Black Friday**: Last Friday of November, 25% off all products
   - **Holiday Sales**: Polish bank holidays, 15% off if order contains any product in eligible categories (Electronics, Home)

4. **Select Best Discount**: Choose the discount with the highest dollar amount (most beneficial to customer).
   - Discounts are calculated on the adjusted subtotal (after location pricing).
   - Only one discount is applied per order.

5. **Calculate Final Total**: Adjusted subtotal - discount amount.

**Example Calculation**:
```
Order: 100 units of Electronics @ $10 each
Location: Europe
Date: Black Friday (Nov 29, 2024)

Base Subtotal: 100 × $10 = $1,000
Location Pricing: $1,000 × 1.15 (Europe) = $1,150

Available Discounts:
- Volume (50+ units): 30% of $1,150 = $345 discount
- Black Friday: 25% of $1,150 = $287.50 discount

Best Discount: Volume (30%, $345)
Final Total: $1,150 - $345 = $805
```

**Priority/Order of Application**:
1. Location pricing is applied first (modifies base price)
2. All discounts are calculated in parallel on the adjusted subtotal
3. The discount with the highest dollar amount is selected
4. No discount stacking or combination

### Stock Consistency

**How It's Ensured**:

1. **Atomic Operations**: All stock updates use atomic MongoDB operations:
   - `findByIdAndUpdate` with `$inc` operator for stock changes
   - `findOneAndUpdate` with stock availability check (`stock: { $gte: quantity }`) for order processing
   - Ensures no race conditions even with concurrent requests

2. **Optimistic Locking for Orders**: Order creation uses atomic stock updates with validation:
   - Validate all products exist and have sufficient stock
   - For each product, atomically update stock only if sufficient stock is available
   - If any atomic update fails (due to insufficient stock from concurrent order), the entire operation fails
   - This approach is simpler than transactions and doesn't require MongoDB replica sets

3. **Validation Before Update**:
   - `SellProductCommand` checks current stock before attempting to decrease
   - `CreateOrderCommand` validates stock for all products before processing, then uses atomic updates
   - Clear error messages when stock is insufficient

**Stock Cannot Go Negative**:
- Mongoose schema enforces `min: 0` constraint on the stock field
- Atomic updates use `$gte` condition to ensure stock availability
- Orders are rejected if any product has insufficient stock (either during initial validation or atomic update)

### Edge Cases Handled

1. **Exact Stock Depletion**: Selling/ordering exactly the available stock is allowed (stock becomes 0).

2. **Multiple Products in Order**: Total units are summed across all products for volume discount calculation.

3. **Mixed Categories**: If an order contains both eligible and non-eligible categories on a holiday, the 15% holiday discount applies to the entire order (as long as at least one eligible product is present).

4. **Rounding**: All monetary calculations use JavaScript's number type (64-bit float). In production, we would use a decimal library (e.g., `decimal.js`) for precise currency calculations.

5. **Holiday and Black Friday Overlap**: Black Friday check takes precedence (checked first in `getDiscountType()`). However, November 29 is never a Polish bank holiday, so this is unlikely to occur.

6. **Variable Holidays**: Easter Monday and Corpus Christi dates are calculated dynamically based on Easter Sunday for the given year.

7. **Product Not Found During Order**: If any product in the order doesn't exist, the entire order fails with 404.

8. **Concurrent Order Handling**: If two orders try to purchase the last few items simultaneously, the atomic updates ensure only one succeeds and the other receives an error message about insufficient stock.

## 4. Testing

### What Is Covered

**Unit Tests** (`tests/unit/`):
- **Discount Calculator**:
  - Location multipliers (US, Europe, Asia)
  - Volume discount tiers (5-9, 10-49, 50+ units)
  - Best discount selection logic
  - Complex pricing scenarios with multiple discounts
- **Date Utilities**:
  - Black Friday detection (last Friday of November)
  - Polish holiday detection (fixed and variable dates)
  - Easter calculation for different years
  - Discount type determination

**Integration Tests** (`tests/integration/`):
- **Products API**:
  - CRUD operations (create, read all, read by ID)
  - Validation errors (missing fields, negative price, negative stock, field length limits)
  - Restock operations
  - Sell operations with stock validation
  - Edge cases (exact stock depletion, insufficient stock)
- **Orders API**:
  - Order creation with various discount scenarios
  - Location-based pricing
  - Volume discounts (all tiers)
  - Multiple products in single order
  - Stock decrease after order
  - Insufficient stock errors
  - Invalid product IDs
  - Validation errors
- **Seasonal Discounts** (with date mocking):
  - Black Friday discount (25% off, last Friday of November)
  - Holiday discounts for eligible categories (15% off)
  - Non-eligible categories during holidays (no discount)
  - Best discount selection (Black Friday vs volume)
  - Seasonal discounts combined with location pricing
- **Concurrent Operations** (atomic operation verification):
  - Concurrent order processing with limited stock
  - Concurrent sell operations preventing overselling
  - Mixed concurrent operations (restock + sell)
  - Stock consistency verification (never negative)

**Why These Were Chosen**:
- Discount calculation is the most complex business logic and most prone to bugs
- Stock management is critical for data integrity
- Date-based logic (holidays) can have edge cases across years
- Concurrent operations verify atomic database operations work correctly
- Seasonal discounts ensure the complete discount system works end-to-end
- Integration tests ensure the entire request/response flow works correctly

### What Is NOT Covered

**Missing from Current Tests**:

1. **Performance and Load Testing**:
   - No tests for system behavior under high load
   - Would require tools like Artillery or k6

2. **Authentication and Authorization**:
   - Not implemented, so no tests
   - Would require JWT token generation/validation tests

3. **Rate Limiting**:
   - No rate limiting implemented
   - Would require tests to ensure DoS protection

4. **Database Connection Failures**:
   - No tests for graceful handling of database outages
   - Would require mocking connection failures

5. **Input Sanitization**:
   - No tests for XSS or injection attacks
   - Would require security-focused testing

**Required in Production**:
- All of the above
- End-to-end tests with real MongoDB instance
- Penetration testing for security vulnerabilities
- Monitoring and alerting integration tests
- Backup and restore procedure tests

## 5. Trade-offs & Alternatives

### Trade-off 1: In-Memory Discount Calculation vs. Stored Discount Rules

**What I Chose**: In-memory discount calculation in `src/utils/discountCalculator.ts`.

**How It Works**:
- Discount rules are hardcoded in the discount calculator functions
- Discounts are calculated on-the-fly for each order based on current date, order size, and location
- No database storage of discount rules or configurations

**Alternative Considered**: Storing discount rules in the database with a flexible rules engine.

**Why I Chose In-Memory**:
1. **Simplicity**: Straightforward to implement and test
2. **Performance**: No database queries needed for discount calculation
3. **Predictability**: Rules are defined in code, making behavior explicit and version-controlled
4. **Sufficient for Requirements**: The task specifies fixed discount rules that don't change

**Downsides of My Approach**:
1. **Inflexibility**: Changing discount rules requires code changes and redeployment
2. **No Business User Control**: Marketing team can't adjust discounts without developer involvement
3. **Hard to A/B Test**: Can't easily test different discount strategies
4. **Audit Trail**: No history of when discount rules changed

**When I Would Change This**:
- If business users need to frequently adjust discount percentages, eligible categories, or add new discount types
- If we need to run promotional campaigns with time-limited custom discounts
- If we want to A/B test different discount strategies
- For a production system with non-technical stakeholders managing promotions

**Better Alternative for Production**:
```typescript
// Discount Rule Schema
{
  type: 'volume' | 'seasonal' | 'promotional',
  name: 'Black Friday 2024',
  startDate: Date,
  endDate: Date,
  conditions: {
    minUnits?: number,
    categories?: string[],
    locations?: string[]
  },
  discountPercentage: number,
  priority: number,
  active: boolean
}
```

This would allow runtime configuration but adds significant complexity:
- Rules engine to evaluate conditions
- Admin UI to manage rules
- Validation to prevent conflicting rules
- Versioning and audit logging

**Specific Files This Affects**:
- `src/utils/discountCalculator.ts`: Contains all hardcoded logic
- `src/commands/CreateOrderCommand.ts`: Calls the calculator with fixed rules
- If changed: Would need `src/models/DiscountRule.ts`, `src/services/DiscountEngine.ts`, and admin endpoints in `src/routes/admin.ts`

### Trade-off 2: Atomic Operations vs. MongoDB Transactions

**What I Chose**: Atomic operations with conditional updates for order processing in `src/commands/CreateOrderCommand.ts`.

**How It Works**:
```typescript
// For each product in the order:
const result = await Product.findOneAndUpdate(
  { _id: productId, stock: { $gte: quantity } },
  { $inc: { stock: -quantity } },
  { new: true }
);
// If no document updated, stock was insufficient
if (!result) {
  throw new AppError('Insufficient stock', 400);
}
```

**Alternative Considered**: MongoDB multi-document transactions.

```typescript
// Transaction approach:
const session = await mongoose.startSession();
session.startTransaction();
try {
  // Fetch products, validate, update stock, create order
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
}
```

**Why I Chose Atomic Operations**:
1. **Simplicity**: No transaction setup or session management needed
2. **No Replica Set Required**: Works with standalone MongoDB (easier for development and testing)
3. **Better Performance**: No transaction overhead, faster for typical workloads
4. **Better Concurrency**: Each update is independent, allowing better parallelism
5. **Easier Testing**: MongoDB Memory Server works without replica set configuration

**Downsides of My Approach**:
1. **Not Fully Atomic Across Multiple Collections**: If order creation fails after stock updates, stock remains decremented (partial failure state)
2. **Error Recovery**: Need to handle cleanup if something fails mid-process
3. **Less Clear Semantics**: Not as immediately obvious that all operations are meant to be atomic

**Why Transactions Might Be Better**:
1. **Full ACID Guarantees**: True atomicity across all operations
2. **Automatic Rollback**: Failed operations automatically roll back all changes
3. **Clearer Intent**: Transaction boundaries make it obvious what should be atomic
4. **Better for Complex Multi-Step Operations**: When multiple collections need coordinated updates

**When I Would Change This**:
- If we need to guarantee that failed orders never decrease stock (though this is unlikely with proper validation)
- If we add more complex multi-collection operations (e.g., inventory reservations, payment processing)
- If we're already running MongoDB as a replica set in production
- If we need audit logging of all changes as a single unit

**Specific Files This Affects**:
- `src/commands/CreateOrderCommand.ts` (lines 60-77): Atomic update implementation
- If changed: Would need MongoDB replica set and transaction setup in tests

**Real-World Consideration**:
For this inventory system, atomic operations are the right choice because:
- Stock validation happens before updates, minimizing partial failure scenarios
- The conditional update (`stock >= quantity`) ensures we never oversell
- Development and testing are much simpler without replica set requirements
- Performance is better for typical e-commerce traffic patterns

However, for a system with complex workflows (reservations, payments, multi-warehouse inventory), I would use transactions despite the added complexity, as the ACID guarantees become more valuable.

