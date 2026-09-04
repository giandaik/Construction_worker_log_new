import mongoose, { Schema, Document } from 'mongoose';

export interface IImpersonationLog extends Document {
  superAdminId: mongoose.Types.ObjectId;
  targetTenantId: mongoose.Types.ObjectId;
  targetUserId: mongoose.Types.ObjectId;
  reason?: string;
  startedAt: Date;
  endedAt?: Date;
}

const ImpersonationLogSchema: Schema = new Schema({
  superAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetTenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
});

ImpersonationLogSchema.index({ superAdminId: 1, startedAt: -1 });
ImpersonationLogSchema.index({ targetTenantId: 1 });

export default mongoose.models.ImpersonationLog ||
  mongoose.model<IImpersonationLog>('ImpersonationLog', ImpersonationLogSchema);
