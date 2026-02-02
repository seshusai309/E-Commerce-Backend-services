import mongoose, { Schema, Document } from 'mongoose';

export interface Dimensions {
  width: number;
  height: number;
  depth: number;
}

export interface Review {
  rating: number;
  comment: string;
  date: string;
  reviewerName: string;
  reviewerEmail: string;
}

export interface Meta {
  createdAt: string;
  updatedAt: string;
  barcode: string;
  qrCode: string;
}

export interface Product extends Document {
  title: string;
  description: string;
  category: string;
  price: number;
  discountPercentage: number;
  rating: number;
  stock: number;
  tags: string[];
  sku: string;
  weight: number;
  dimensions: Dimensions;
  warrantyInformation: string;
  shippingInformation: string;
  availabilityStatus: string;
  reviews: Review[];
  returnPolicy: string;
  minimumOrderQuantity: number;
  meta: Meta;
  images: string[];
  thumbnail: string;
  createdAt: Date;
  updatedAt: Date;
}

const dimensionsSchema = new Schema({
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  depth: { type: Number, required: true }
}, { _id: false });

const reviewSchema = new Schema({
  rating: { type: Number, required: true },
  comment: { type: String, required: true },
  date: { type: String, required: true },
  reviewerName: { type: String, required: true },
  reviewerEmail: { type: String, required: true }
}, { _id: false });

const metaSchema = new Schema({
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
  barcode: { type: String, required: true },
  qrCode: { type: String, required: true }
}, { _id: false });

const productSchema = new Schema<Product>({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  discountPercentage: { type: Number, required: true },
  rating: { type: Number, required: true },
  stock: { type: Number, required: true },
  tags: [{ type: String }],
  sku: { type: String, required: true },
  weight: { type: Number, required: true },
  dimensions: { type: dimensionsSchema, required: true },
  warrantyInformation: { type: String, required: true },
  shippingInformation: { type: String, required: true },
  availabilityStatus: { type: String, required: true },
  reviews: [reviewSchema],
  returnPolicy: { type: String, required: true },
  minimumOrderQuantity: { type: Number, required: true },
  meta: { type: metaSchema, required: true },
  images: [{ type: String }],
  thumbnail: { type: String, required: true }
}, { timestamps: true });

export const ProductModel = mongoose.model<Product>('Product', productSchema);
