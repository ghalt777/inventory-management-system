import { Router, Request, Response } from 'express';
import { CreateOrderCommand } from '../commands/CreateOrderCommand';
import { validateRequest } from '../middleware/validateRequest';
import { asyncHandler } from '../middleware/errorHandler';
import { createOrderSchema } from '../validation/schemas';

const router = Router();

// POST /orders - Create a new order
router.post(
  '/',
  validateRequest(createOrderSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const command = new CreateOrderCommand();
    const order = await command.execute(req.body);
    res.status(201).json(order);
  })
);

export default router;

