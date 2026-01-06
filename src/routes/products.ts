import { Router, Request, Response } from 'express';
import { CreateProductCommand } from '../commands/CreateProductCommand';
import { RestockProductCommand } from '../commands/RestockProductCommand';
import { SellProductCommand } from '../commands/SellProductCommand';
import { GetAllProductsQuery } from '../queries/GetAllProductsQuery';
import { GetProductByIdQuery } from '../queries/GetProductByIdQuery';
import { validateRequest } from '../middleware/validateRequest';
import { asyncHandler } from '../middleware/errorHandler';
import {
  createProductSchema,
  restockProductSchema,
  sellProductSchema,
} from '../validation/schemas';

const router = Router();

// GET /products - Retrieve all products
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const query = new GetAllProductsQuery();
    const products = await query.execute();
    res.json(products);
  })
);

// GET /products/:id - Retrieve a single product
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const query = new GetProductByIdQuery();
    const product = await query.execute(req.params.id);
    res.json(product);
  })
);

// POST /products - Create a new product
router.post(
  '/',
  validateRequest(createProductSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const command = new CreateProductCommand();
    const product = await command.execute(req.body);
    res.status(201).json(product);
  })
);

// POST /products/:id/restock - Increase stock level
router.post(
  '/:id/restock',
  validateRequest(restockProductSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const command = new RestockProductCommand();
    const product = await command.execute({
      productId: req.params.id,
      quantity: req.body.quantity,
    });
    res.json(product);
  })
);

// POST /products/:id/sell - Decrease stock level
router.post(
  '/:id/sell',
  validateRequest(sellProductSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const command = new SellProductCommand();
    const product = await command.execute({
      productId: req.params.id,
      quantity: req.body.quantity,
    });
    res.json(product);
  })
);

export default router;

