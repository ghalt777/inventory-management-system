import Joi from 'joi';

export const createProductSchema = Joi.object({
  name: Joi.string().required().max(50).trim(),
  description: Joi.string().required().max(50).trim(),
  price: Joi.number().required().positive(),
  stock: Joi.number().required().min(0).integer(),
  category: Joi.string().required().trim(),
});

export const restockProductSchema = Joi.object({
  quantity: Joi.number().required().positive().integer(),
});

export const sellProductSchema = Joi.object({
  quantity: Joi.number().required().positive().integer(),
});

export const createOrderSchema = Joi.object({
  customerId: Joi.string().required().trim(),
  customerLocation: Joi.string().required().valid('US', 'Europe', 'Asia'),
  products: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().required(),
        quantity: Joi.number().required().positive().integer(),
      })
    )
    .min(1)
    .required(),
});

