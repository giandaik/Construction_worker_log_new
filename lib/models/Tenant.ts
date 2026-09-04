import mongoose, { Schema, Document } from 'mongoose';

export interface ITenant extends Document {
  name: string;
  slug: string;
  status: 'active' | 'disabled' | 'suspended';
  plan: string;
  createdAt: Date;
  updatedAt: Date;
}

const TenantSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    status: { type: String, enum: ['active', 'disabled', 'suspended'], default: 'active' },
    plan: { type: String, default: 'free' },
  },
  { timestamps: true }
);

export default mongoose.models.Tenant || mongoose.model<ITenant>('Tenant', TenantSchema);
