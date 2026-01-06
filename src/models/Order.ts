import mongoose, { Document, Schema } from 'mongoose';

export type CustomerLocation = 'US' | 'Europe' | 'Asia';

export interface IOrderProduct {
  productId: string;
  quantity: number;
  price: number;
  name: string;
}

export interface IAppliedDiscount {
  type: 'volume' | 'black_friday' | 'holiday' | 'none';
  percentage: number;
  amount: number;
}

export interface IOrder extends Document {
  customerId: string;
  customerLocation: CustomerLocation;
  products: IOrderProduct[];
  subtotal: number;
  locationMultiplier: number;
  adjustedSubtotal: number;
  appliedDiscount: IAppliedDiscount;
  totalAmount: number;
  orderDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema: Schema = new Schema(
  {
    customerId: {
      type: String,
      required: true,
      trim: true,
    },
    customerLocation: {
      type: String,
      required: true,
      enum: ['US', 'Europe', 'Asia'],
    },
    products: [
      {
        productId: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
      },
    ],
    subtotal: {
      type: Number,
      required: true,
    },
    locationMultiplier: {
      type: Number,
      required: true,
    },
    adjustedSubtotal: {
      type: Number,
      required: true,
    },
    appliedDiscount: {
      type: {
        type: String,
        enum: ['volume', 'black_friday', 'holiday', 'none'],
        required: true,
      },
      percentage: {
        type: Number,
        required: true,
        min: 0,
      },
      amount: {
        type: Number,
        required: true,
        min: 0,
      },
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    orderDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
OrderSchema.index({ customerId: 1, orderDate: -1 });
OrderSchema.index({ orderDate: -1 });

export const Order = mongoose.model<IOrder>('Order', OrderSchema);

