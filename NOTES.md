# Development Notes

## 1. Assumptions & Simplifications

### Customer Model
No dedicated customer database. The `customerId` is just a string passed in the order request and stored in the order document. This keeps things simple and lets us focus on inventory/order logic.

### Location-Based Pricing
Customer location is passed explicitly in the order request. Could derive it from IP geolocation or customer profile, but explicit is simpler for now.

### Holiday Sales Categories
Holiday discounts only apply to "Electronics" and "Home" categories. The task asked for two categories, so I picked these and hardcoded them.

### Bank Holidays
All seasonal holiday sales are based on Polish bank holidays as specified in the requirements.

**Fixed dates**: New Year (Jan 1), Labour Day (May 1), Constitution Day (May 3), Assumption of Mary (Aug 15), All Saints (Nov 1), Independence Day (Nov 11), Christmas (Dec 25-26)

**Variable dates**: Easter Monday (Easter + 1 day), Corpus Christi (Easter + 60 days)

Easter calculation uses the Anonymous Gregorian algorithm.

### Black Friday
Last Friday of November each year. 25% off all products.

### Authentication & Authorization
Not implemented. The task didn't require it.

### Timezone Handling
All dates use the server's timezone. Could be an issue for Black Friday timing across regions, but works for this scope.

## 2. Technical Decisions

### Database: MongoDB with Mongoose

MongoDB fits well because:
- Flexible schema for products with varying attributes
- JSON-like documents work naturally with TypeScript
- Good aggregation pipeline for reports
- Scales horizontally

Mongoose adds:
- Schema validation at the app level
- Type safety with TypeScript
- Connection management
- Middleware hooks if needed

Considered the native MongoDB driver but Mongoose's DX and type safety won out.

### CQRS Pattern

Commands (`src/commands/`) handle all writes. Queries (`src/queries/`) handle all reads. Each command is a class with an `execute()` method.

Benefits:
- Clear separation of concerns
- Easy to test in isolation
- Could scale reads/writes independently later
- Better organization

Didn't go full event sourcing - too much complexity for this scope. Simple CQRS gives most of the benefits.

### Project Structure

```
src/
  commands/          # Write operations
  queries/           # Read operations
  models/            # Mongoose schemas
  routes/            # Express route handlers
  middleware/        # Validation, error handling
  utils/             # Discount calculator, date utilities
  config/            # Database connection, environment config
  server.ts          # Entry point
tests/
  unit/              # Unit tests
  integration/       # API integration tests
```

Structure mirrors CQRS boundaries and makes it easy to find code by functionality.

### Validation

Joi for request validation - declarative schemas, good error messages, clean middleware pattern.

Mongoose for data validation - second layer at the DB level, prevents bad data even if middleware is bypassed.

Zod is installed but I went with Joi since it's more established for Express. Either would work.

### Error Handling

Custom `AppError` class for operational errors (product not found, insufficient stock) with specific HTTP status codes. Global error handler middleware catches everything and formats consistent JSON responses. Async handler wrapper catches async errors automatically.

This gives consistent error responses and clear separation between operational errors (4xx) and unexpected errors (5xx).

## 3. Business Logic

### Discount System

**Calculation flow:**

1. Calculate base subtotal: sum of (price × quantity) for all products

2. Apply location multiplier to get adjusted subtotal:
   - US: 1.0×
   - Europe: 1.15× (VAT)
   - Asia: 0.95× (reduced logistics)

3. Calculate all applicable discounts on adjusted subtotal:
   - Volume: 5-9 units = 10%, 10-49 = 20%, 50+ = 30%
   - Black Friday: 25% off all products (last Friday of November)
   - Holiday: 15% off if order contains Electronics or Home (Polish bank holidays)

4. Select the discount with highest dollar amount (best for customer)

5. Final total = adjusted subtotal - discount amount

**Example:**
```
100 units of Electronics @ $10 each
Location: Europe
Date: Black Friday (Nov 29, 2024)

Base Subtotal: $1,000
Adjusted Subtotal: $1,000 × 1.15 = $1,150

Available Discounts:
- Volume (50+ units): 30% = $345
- Black Friday: 25% = $287.50

Best Discount: Volume ($345)
Final Total: $1,150 - $345 = $805
```

Only one discount applies per order. Location pricing is applied first, then discounts are calculated on the adjusted subtotal.

### Stock Consistency

Stock updates use atomic MongoDB operations:
- `findOneAndUpdate` with `stock: { $gte: quantity }` condition
- If the condition fails, the update doesn't happen
- This prevents race conditions even with concurrent requests

For orders, we validate all products exist and have sufficient stock first, then atomically update each product's stock. If any atomic update fails (concurrent order took the stock), the whole operation fails.

Mongoose schema enforces `min: 0` on stock, and atomic updates use `$gte` to ensure availability. Stock can't go negative.

### Edge Cases

- Exact stock depletion (stock becomes 0) is allowed
- Multiple products: total units summed for volume discount
- Mixed categories on holidays: if any product is eligible (Electronics/Home), the whole order gets 15% off
- Rounding: uses JavaScript numbers (64-bit float). For production, would use a decimal library
- Black Friday vs holiday: Black Friday check happens first, but Nov 29 is never a Polish holiday anyway
- Variable holidays: Easter Monday and Corpus Christi calculated dynamically from Easter
- Product not found: entire order fails with 404
- Concurrent orders: atomic updates ensure only one succeeds, others get insufficient stock error

## 4. Testing

### What's Covered

**Unit tests:**
- Discount calculator: location multipliers, volume tiers, best discount selection, complex scenarios
- Date utilities: Black Friday detection, Polish holidays, Easter calculation, discount type determination

**Integration tests:**
- Products API: CRUD, validation errors, restock, sell operations, edge cases
- Orders API: order creation with discounts, location pricing, volume discounts, multiple products, stock updates, error handling
- Seasonal discounts: Black Friday, holiday discounts, best discount selection, combined with location pricing
- Concurrent operations: concurrent orders with limited stock, concurrent sells, mixed operations, stock consistency

Focused on discount logic (most complex), stock management (critical for integrity), date logic (edge cases), and concurrent operations (verifies atomic updates work).

### What's Not Covered

- Performance/load testing
- Authentication/authorization (not implemented)
- Rate limiting
- Database connection failures
- Input sanitization/XSS/injection

These would be needed for production but are out of scope for this project.

## 5. Trade-offs

### In-Memory Discount Calculation

Discount rules are hardcoded in `src/utils/discountCalculator.ts`. Calculated on-the-fly based on date, order size, and location. No database storage.

**Why:** Simple, fast (no DB queries), predictable (version-controlled in code), and sufficient since the rules are fixed.

**Downside:** Changing rules requires code changes and redeployment. Marketing can't adjust discounts without a developer.

Could store rules in the database with a rules engine, but that adds a lot of complexity (rules engine, admin UI, validation, versioning). Not worth it for fixed rules.

### Atomic Operations vs Transactions

Using atomic operations with conditional updates in `CreateOrderCommand.ts`:

```typescript
const result = await Product.findOneAndUpdate(
  { _id: productId, stock: { $gte: quantity } },
  { $inc: { stock: -quantity } },
  { new: true }
);
if (!result) {
  throw new AppError('Insufficient stock', 400);
}
```

**Why:** Simpler (no transaction setup), works with standalone MongoDB (easier dev/testing), better performance, easier testing with MongoDB Memory Server.

**Downside:** Not fully atomic across collections. If order creation fails after stock updates, stock stays decremented. But validation happens before updates, so this is unlikely.

Transactions would give full ACID guarantees and automatic rollback, but require a replica set and add complexity. For this system, atomic operations work well because:
- Stock validation happens before updates
- Conditional update ensures we never oversell
- Simpler dev/testing
- Better performance

For complex workflows (reservations, payments, multi-warehouse), transactions would be worth the added complexity.
