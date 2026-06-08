import React, { useState, useEffect, useMemo, useCallback } from 'react';
import mongoose from 'mongoose';
import type { WorkLogFormProps } from '../types/components';
import type { IProject } from '@/lib/models';
import { useWorkLogForm } from '@/hooks/useWorkLogForm';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useToast } from '@/hooks/useToast';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/forms/FormField';
import { ArrayField } from '@/components/forms/ArrayField';
import { SignatureSection } from '@/components/SignatureSection';
import { PhotoUpload } from '@/components/forms/PhotoUpload';
import { TOAST_DURATION } from '@/lib/constants/constants';

export const WorkLogForm = React.memo<WorkLogFormProps>(({ onSubmit }) => {
  const [projects, setProjects] = useState<IProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  // Custom hooks for cleaner separation of concerns
  const {
    formData,
    handleChange,
    personnel,
    equipment,
    materials,
    updateSignatures,
    updateImages,
    resetForm,
  } = useWorkLogForm();

  const { isOnline, submitWorkLog } = useOfflineSync();
  const { toast, showError } = useToast();

  // Memoize project options to prevent unnecessary re-renders
  const projectOptions = useMemo(() => {
    return projects.map(project => (
      <option key={project._id?.toString()} value={project._id?.toString()}>
        {project.name}
      </option>
    ));
  }, [projects]);

  // Fetch real projects from API
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setIsLoadingProjects(true);
        const response = await fetch('/api/projects');

        if (!response.ok) {
          throw new Error('Failed to fetch projects');
        }

        const data = await response.json();
        setProjects(data);
      } catch (error) {
        console.error('Error fetching projects:', error);
        showError('Failed to load projects. Please refresh the page.');
        // Set empty array on error so form can still be used
        setProjects([]);
      } finally {
        setIsLoadingProjects(false);
      }
    };

    fetchProjects();
  }, [showError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!onSubmit) {
      console.warn('WorkLogForm: onSubmit prop is not provided.');
      return;
    }

    try {
      await submitWorkLog({
        onlineSubmit: onSubmit,
        formData,
      });
      resetForm();
    } catch (error) {
      // Error already handled by useOfflineSync
      console.error('Form submission error:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isOnline && (
        <Alert variant="warning">
          You are currently offline. Submissions will be saved locally and synced later.
        </Alert>
      )}
      {toast && (
        <Alert variant={toast.type}>
          {toast.message}
        </Alert>
      )}

      <FormField label="Date" htmlFor="date" required>
        <input
          type="date"
          id="date"
          name="date"
          value={formData.date}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          required
        />
      </FormField>

      <FormField label="Project" htmlFor="project" required>
        <select
          id="project"
          name="project"
          value={formData.project}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          required
          disabled={isLoadingProjects}
        >
          <option value="">
            {isLoadingProjects ? 'Loading projects...' : 'Select a project'}
          </option>
          {projectOptions}
        </select>
      </FormField>

      <FormField label="Weather" htmlFor="weather">
        <input
          type="text"
          id="weather"
          name="weather"
          value={formData.weather || ''}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </FormField>

      <FormField label="Temperature (°C)" htmlFor="temperature">
        <input
          type="number"
          id="temperature"
          name="temperature"
          value={formData.temperature || ''}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </FormField>

      <FormField label="Work Description" htmlFor="workDescription" required>
        <textarea
          id="workDescription"
          name="workDescription"
          value={formData.workDescription}
          onChange={handleChange}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          required
        />
      </FormField>

      <FormField label="Notes" htmlFor="notes">
        <textarea
          id="notes"
          name="notes"
          value={formData.notes || ''}
          onChange={handleChange}
          rows={2}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </FormField>

      <ArrayField
        title="Personnel"
        items={formData.personnel}
        onAdd={personnel.add}
        onRemove={personnel.remove}
        addButtonText="Add Personnel"
        renderFields={(item, index) => (
          <div className="grid grid-cols-2 gap-4 pr-8">
            <FormField label="Role" htmlFor={`personnel-role-${index}`}>
              <input
                type="text"
                id={`personnel-role-${index}`}
                value={item.role}
                onChange={(e) => personnel.update(index, 'role', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </FormField>
            <FormField label="Count" htmlFor={`personnel-count-${index}`}>
              <select
                id={`personnel-count-${index}`}
                value={item.count}
                onChange={(e) => personnel.update(index, 'count', parseInt(e.target.value) || 0)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                {Array.from({ length: 10 }, (_, i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </FormField>
          </div>
        )}
      />

      <ArrayField
        title="Equipment"
        items={formData.equipment}
        onAdd={equipment.add}
        onRemove={equipment.remove}
        addButtonText="Add Equipment"
        renderFields={(item, index) => (
          <div className="grid grid-cols-3 gap-4 pr-8">
            <FormField label="Type" htmlFor={`equipment-type-${index}`}>
              <input
                type="text"
                id={`equipment-type-${index}`}
                value={item.type}
                onChange={(e) => equipment.update(index, 'type', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </FormField>
            <FormField label="Count" htmlFor={`equipment-count-${index}`}>
              <input
                type="number"
                id={`equipment-count-${index}`}
                value={item.count}
                onChange={(e) => equipment.update(index, 'count', parseInt(e.target.value) || 0)}
                min="1"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </FormField>
            <FormField label="Hours" htmlFor={`equipment-hours-${index}`}>
              <input
                type="number"
                id={`equipment-hours-${index}`}
                value={item.hours || ''}
                onChange={(e) => equipment.update(index, 'hours', parseFloat(e.target.value) || 0)}
                min="0"
                step="0.5"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </FormField>
          </div>
        )}
      />

      <ArrayField
        title="Materials"
        items={formData.materials}
        onAdd={materials.add}
        onRemove={materials.remove}
        addButtonText="Add Material"
        renderFields={(item, index) => (
          <div className="grid grid-cols-3 gap-4 pr-8">
            <FormField label="Name" htmlFor={`material-name-${index}`}>
              <input
                type="text"
                id={`material-name-${index}`}
                value={item.name}
                onChange={(e) => materials.update(index, 'name', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </FormField>
            <FormField label="Quantity" htmlFor={`material-quantity-${index}`}>
              <input
                type="number"
                id={`material-quantity-${index}`}
                value={item.quantity}
                onChange={(e) => materials.update(index, 'quantity', parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </FormField>
            <FormField label="Unit" htmlFor={`material-unit-${index}`}>
              <input
                type="text"
                id={`material-unit-${index}`}
                value={item.unit}
                onChange={(e) => materials.update(index, 'unit', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </FormField>
          </div>
        )}
      />

      <PhotoUpload
        value={formData.images}
        onChange={updateImages}
      />

      <SignatureSection
        signatures={formData.signatures || []}
        onChange={updateSignatures}
      />

      <Button type="submit" className="w-full">
        Submit Work Log
      </Button>
    </form>
  );
}); 