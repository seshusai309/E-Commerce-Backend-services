import mongoose, { Document, Schema } from 'mongoose';

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE'
}

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN'
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault?: boolean; // To mark primary address
  addressType?: 'home' | 'work' | 'billing' | 'shipping';
}

export interface CustomerData {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  landlineNumber?: string;
  countryCode: string;
  address: Address;
  businessInfo?: {
    companyName: string;
    businessType: string;
    vatNumber: string;
    websiteUrl?: string;
  };
  submittedAt: Date;
}

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  status: UserStatus;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  countryCode?: string;
  addresses?: Address[]; // Array of addresses
  customerData?: CustomerData; // Keep for backward compatibility
  otp?: string;
  otpExpires?: Date;
  pendingUpdate?: any; // Temporary field for storing profile update data
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
  addressType: { type: String, enum: ['home', 'work', 'billing', 'shipping'], default: 'home' }
}, { _id: false });

const businessInfoSchema = new Schema({
  companyName: { type: String, required: true },
  businessType: { type: String, required: true },
  vatNumber: { type: String, required: true },
  websiteUrl: { type: String }
}, { _id: false });

const customerDataSchema = new Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  landlineNumber: { type: String },
  countryCode: { type: String, required: true },
  address: { type: addressSchema, required: true },
  businessInfo: { type: businessInfoSchema },
  submittedAt: { type: Date, default: Date.now }
}, { _id: false });

const userSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  status: { 
    type: String, 
    enum: Object.values(UserStatus), 
    default: UserStatus.INACTIVE 
  },
  role: { 
    type: String, 
    enum: Object.values(UserRole), 
    default: UserRole.USER 
  },
  firstName: { type: String },
  lastName: { type: String },
  phoneNumber: { type: String },
  countryCode: { type: String },
  addresses: [{ type: addressSchema }],
  customerData: { type: customerDataSchema },
  otp: { type: String },
  otpExpires: { type: Date }
}, { timestamps: true });

export const User = mongoose.model<IUser>('User', userSchema);
