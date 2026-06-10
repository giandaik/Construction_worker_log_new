import mongoose, { Schema, Document } from 'mongoose';
import './User'; // Import User model to ensure it's registered
import { IUser } from './User';

export interface IProject extends Document {
  name: string;
  description: string;
  location: string;
  startDate: Date;
  endDate?: Date;
  status: 'planned' | 'in-progress' | 'completed' | 'on-hold';
  manager: mongoose.Types.ObjectId | IUser;
  createdAt: Date;
  updatedAt: Date;
  ownerEmail: string;
  contractorEmail: string;
  ownerUserId: mongoose.Types.ObjectId | IUser;
  contractorUserId: mongoose.Types.ObjectId | IUser;
}

const ProjectSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String},
    location: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    status: { 
      type: String, 
      enum: ['planned', 'in-progress', 'completed', 'on-hold'], 
      default: 'planned' 
    },
    ownerEmail: { type: String, required: true },
    contractorEmail: { type: String, required: true },

    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    contractorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    manager: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
  },
  { timestamps: true }
);

ProjectSchema.index({ name: 1 });
ProjectSchema.index({ status: 1 });

ProjectSchema.index({ ownerUserId: 1 });
ProjectSchema.index({ contractorUserId: 1 });

ProjectSchema.index({ ownerEmail: 1 });
ProjectSchema.index({ contractorEmail: 1 });

export default mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);
