import mongoose, { Schema, Document } from 'mongoose';
import './User'; // Import User model to ensure it's registered
import './Project'; // Import Project model to ensure it's registered
import { IUser } from './User';
import { IProject } from './Project';

/**
 * WorkLog Document Interface
 * Represents a daily work log entry for construction projects
 */
export interface IWorkLog extends Document {
  date: Date;
  project: mongoose.Types.ObjectId | IProject;
  author: mongoose.Types.ObjectId | IUser;
  weather?: string;
  temperature?: number;
  workDescription: string;
  personnel: Array<{
    role: string;
    count: number;
    workDetails: string;
  }>;
  equipment: Array<{
    type: string;
    count: number;
    hours?: number;
  }>;
  materials: Array<{
    name: string;
    quantity: number;
    unit: string;
  }>;
  issues?: string;
  notes?: string;
  images?: string[];
  dwgRefs?: string[];
  status: string;
  createdAt: Date;
  updatedAt: Date;
}


const WorkLogSchema: Schema = new Schema(
  {
    date: { type: Date, required: true },
    project: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Project', 
      required: true 
    },
    author: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    weather: { type: String },
    temperature: { type: Number },
    workDescription: { type: String },
    personnel: [{ 
      role: { type: String},
      count: { type: Number },
      workDetails: { type: String}
    }],
    equipment: [{ 
      type: { type: String },
      count: { type: Number },
      hours: { type: Number }
    }],
    materials: [{ 
      name: { type: String },
      quantity: { type: Number},
      unit: { type: String }
    }],
    issues: { type: String },
    notes: { type: String },
    status: {type: String},
    images: [{ type: String }],
    dwgRefs: { type: [String], default: [] }
  },
  { timestamps: true }
);

WorkLogSchema.index({ project: 1, createdAt: -1 });
WorkLogSchema.index({ author: 1, createdAt: -1 });
WorkLogSchema.index({ date: -1 });
WorkLogSchema.index({ status: 1 });

export default mongoose.models.WorkLog || mongoose.model<IWorkLog>('WorkLog', WorkLogSchema); 