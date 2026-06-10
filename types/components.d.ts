import { FC } from 'react';
import type { IWorkLog } from '@/lib/models';
import { Types } from 'mongoose';

/**
 * Plain data object for WorkLog form submission (not a Mongoose Document)
 */
export interface WorkLogFormData {
  date: Date;
  project: Types.ObjectId;
  author: string;
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
}

export interface WorkLogFormProps {
  onSubmit?: (data: WorkLogFormData) => Promise<void>;
  initialProject?: string;
}

export const WorkLogForm: FC<WorkLogFormProps>; 