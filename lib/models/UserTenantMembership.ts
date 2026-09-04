import mongoose, { Schema, Document } from 'mongoose';

export type TenantRole = 'ADMIN' | 'MANAGER' | 'WORKER';

export interface IUserTenantMembership extends Document {
  userId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  tenantRole: TenantRole;
  isActive: boolean;
  joinedAt: Date;
}

const UserTenantMembershipSchema: Schema = new Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  tenantRole: { type: String, enum: ['ADMIN', 'MANAGER', 'WORKER', 'admin', 'manager', 'worker'], default: 'WORKER' },
  isActive: { type: Boolean, default: true },
  joinedAt: { type: Date, default: Date.now },
});

// Unique constraint: a user can only have one role per tenant
UserTenantMembershipSchema.index({ userId: 1, tenantId: 1 }, { unique: true });
UserTenantMembershipSchema.index({ tenantId: 1 });
UserTenantMembershipSchema.index({ userId: 1 });

export default mongoose.models.UserTenantMembership ||
  mongoose.model<IUserTenantMembership>('UserTenantMembership', UserTenantMembershipSchema);
