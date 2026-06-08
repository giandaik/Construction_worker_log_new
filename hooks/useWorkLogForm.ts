import { useState, useCallback } from 'react';
import mongoose from 'mongoose';
import { DEFAULT_PERSONNEL, DEFAULT_EQUIPMENT, DEFAULT_MATERIALS } from '@/lib/constants/constants';
import type { Personnel, Equipment, Material, Signature } from '@/types/shared';

/**
 * Form data matching the unified WorkLog schema
 * Uses centralized types from @/types/shared
 */
export type WorkLogFormData = {
  date: string;
  project: string;
  weather?: string;
  temperature?: number;
  workDescription: string;
  personnel: Personnel[];
  equipment: Equipment[];
  materials: Material[];
  notes?: string;
  signatures?: Signature[];
  images: string[];
};

/**
 * Custom hook to manage work log form state and array field operations
 * Extracts complex form logic from the WorkLogForm component
 */
export function useWorkLogForm() {
  const [formData, setFormData] = useState<WorkLogFormData>({
    date: new Date().toISOString().split('T')[0],
    project: '',
    workDescription: '',
    personnel: [],
    equipment: [],
    materials: [],
    signatures: [],
    images: [],
  });

  /**
   * Handle basic input field changes
   */
  const handleChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  /**
   * Add a personnel entry
   */
  const addPersonnel = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      personnel: [...prev.personnel, DEFAULT_PERSONNEL]
    }));
  }, []);

  /**
   * Update a personnel entry
   */
  const updatePersonnel = useCallback((index: number, field: keyof typeof DEFAULT_PERSONNEL, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      personnel: prev.personnel.map((p, i) =>
        i === index ? { ...p, [field]: value } : p
      )
    }));
  }, []);

  /**
   * Remove a personnel entry
   */
  const removePersonnel = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      personnel: prev.personnel.filter((_, i) => i !== index)
    }));
  }, []);

  /**
   * Add an equipment entry
   */
  const addEquipment = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      equipment: [...prev.equipment, DEFAULT_EQUIPMENT]
    }));
  }, []);

  /**
   * Update an equipment entry
   */
  const updateEquipment = useCallback((index: number, field: keyof typeof DEFAULT_EQUIPMENT, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      equipment: prev.equipment.map((e, i) =>
        i === index ? { ...e, [field]: value } : e
      )
    }));
  }, []);

  /**
   * Remove an equipment entry
   */
  const removeEquipment = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      equipment: prev.equipment.filter((_, i) => i !== index)
    }));
  }, []);

  /**
   * Add a material entry
   */
  const addMaterial = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      materials: [...prev.materials, DEFAULT_MATERIALS]
    }));
  }, []);

  /**
   * Update a material entry
   */
  const updateMaterial = useCallback((index: number, field: keyof typeof DEFAULT_MATERIALS, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      materials: prev.materials.map((m, i) =>
        i === index ? { ...m, [field]: value } : m
      )
    }));
  }, []);

  /**
   * Remove a material entry
   */
  const removeMaterial = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      materials: prev.materials.filter((_, i) => i !== index)
    }));
  }, []);

  /**
   * Update signatures array
   */
  const updateSignatures = useCallback((signatures: Signature[]) => {
    setFormData(prev => ({
      ...prev,
      signatures
    }));
  }, []);

  /**
   * Update images array
   */
  const updateImages = useCallback((images: string[]) => {
    setFormData(prev => ({
      ...prev,
      images
    }));
  }, []);

  /**
   * Reset form to initial state
   */
  const resetForm = useCallback(() => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      project: '',
      workDescription: '',
      personnel: [],
      equipment: [],
      materials: [],
      signatures: [],
      images: [],
    });
  }, []);

  /**
   * Convert form data to API format
   */
  const toAPIFormat = useCallback((authorId: string) => {
    return {
      ...formData,
      date: new Date(formData.date),
      project: new mongoose.Types.ObjectId(formData.project),
      author: authorId
    };
  }, [formData]);

  return {
    formData,
    handleChange,
    personnel: {
      add: addPersonnel,
      update: updatePersonnel,
      remove: removePersonnel,
    },
    equipment: {
      add: addEquipment,
      update: updateEquipment,
      remove: removeEquipment,
    },
    materials: {
      add: addMaterial,
      update: updateMaterial,
      remove: removeMaterial,
    },
    updateSignatures,
    updateImages,
    resetForm,
    toAPIFormat,
  };
}
