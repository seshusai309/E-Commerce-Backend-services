import mongoose, { Schema, Document } from 'mongoose';

export interface OrderItem {
  productId: string; // MongoDB _id
  title: string;
  price: number;
  quantity: number;
  thumbnail: string;
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface Order extends Document {
  userId: string; // Required for logged-in users
  items: OrderItem[];
  totalAmount: number;
  totalItems: number;
  shippingAddress: ShippingAddress;
  paymentMethod: "ONLINE" | "COD";
  paymentStatus: "PENDING" | "PAID";
  orderStatus: "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  sessionId?: string; // For Stripe Checkout Session integration
  transactionId?: string; // For payment tracking
  orderNumber: string; // Unique order identifier
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema({
  productId: { type: String, required: true }, // MongoDB _id
  title: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  thumbnail: { type: String, required: true }
}, { _id: false });

const shippingAddressSchema = new Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, required: true },
  isDefault: { type: Boolean, default: false }
}, { _id: false });

const orderSchema = new Schema<Order>({
  userId: { type: String, required: true }, // Required for logged-in users only
  items: [orderItemSchema],
  totalAmount: { type: Number, required: true },
  totalItems: { type: Number, required: true },
  shippingAddress: { type: shippingAddressSchema, required: true },
  paymentMethod: { 
    type: String, 
    required: true, 
    enum: ["ONLINE", "COD"] 
  },
  paymentStatus: { 
    type: String, 
    required: true, 
    enum: ["PENDING", "PAID"],
    default: "PENDING"
  },
  orderStatus: { 
    type: String, 
    required: true, 
    enum: ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"],
    default: "PENDING"
  },
  sessionId: { type: String }, // For Stripe Checkout Session integration
  transactionId: { type: String }, // For payment tracking
  orderNumber: { type: String, required: true, unique: true }, // Unique order identifier
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Index for efficient lookups
orderSchema.index({ userId: 1, isActive: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ paymentStatus: 1 });

// Generate unique order number before saving
orderSchema.pre('validate', function() {
  if (this.isNew && !this.orderNumber) {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.orderNumber = `ORD${timestamp}${random}`;
  }
});

export const OrderModel = mongoose.model<Order>('Order', orderSchema);
