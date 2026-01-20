import { ObjectId } from 'mongodb';

export type UserRole = 'ADMIN' | 'USER';

export interface UserDocument {
  _id?: ObjectId;
  email: string;
  password: string; // hashed password
  role: UserRole;
  name?: string;
  phone?: string;
  isActive?: boolean; // for soft delete/deactivation
  isCompleted?: boolean;
  provider?: string;
  addresses?: ObjectId[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Address {
  _id?: ObjectId;
  user: ObjectId;
  name: string;
  location_remark?: string;
  phone?: string;
  email: string;
  street_address: string;
  city: string;
  province?: string;
  postal_code: string;
  apartment?: string;
  floor?: string;
  entrance?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// User with populated addresses (for admin display)
export interface UserWithAddresses extends Omit<UserDocument, 'password' | 'addresses'> {
  addresses?: Address[];
}
