import mongoose, { Schema, Document } from 'mongoose';
import { PLATFORM_ROLES } from '@/lib/constants/roles';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'manager' | 'user';
  platformRole?: 'SUPER_ADMIN';
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { 
      type: String, 
      enum: ['admin', 'manager', 'user'], 
      default: 'user' 
    },
    platformRole: {
      type: String,
      enum: [PLATFORM_ROLES.SUPER_ADMIN, 'super_admin'],
      default: null,
    },
  },
  { timestamps: true }
);

// Prevent model overwrite error during hot reloading in development
export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema); 