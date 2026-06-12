import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import mongoose from 'mongoose';
import type { WorkLogFormProps } from '../types/components';
import type { IProject } from '@/lib/models';
import { useWorkLogForm } from '@/hooks/useWorkLogForm';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useToast } from '@/hooks/useToast';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/forms/FormField';
import { FormSection } from '@/components/forms/FormSection';
import { ArrayField } from '@/components/forms/ArrayField';
import { SignatureSection } from '@/components/SignatureSection';
import { PhotoUpload } from '@/components/forms/PhotoUpload';
import { DwgPicker } from '@/components/forms/DwgPicker';
import { Combobox } from '@/components/forms/Combobox';
import { WeatherPicker } from '@/components/forms/WeatherPicker';
import { useSuggestions } from '@/hooks/useSuggestions';
import { TOAST_DURATION } from '@/lib/constants/constants';

const DUPLICATE_WORKLOG_MESSAGE = 'A work log already exists for this project on the selected day.';

function PersonnelCountField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const isCustom = value > 9;
  const [showCustom, setShowCustom] = useState(isCustom);
  const [customValue, setCustomValue] = useState(isCustom ? String(value) : '');

  const selectClass =
    'mt-1 block w-full rounded-md border-input bg-background shadow-sm focus:border-ring focus:ring-ring sm:text-sm';

  if (showCustom) {
    return (
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          id={id}
          min={0}
          value={customValue}
          onChange={(e) => {
            setCustomValue(e.target.value);
            const n = parseInt(e.target.value, 10);
            if (!isNaN(n) && n >= 0) onChange(n);
          }}
          className={selectClass}
          placeholder="Enter number"
          autoFocus
        />
        <button
          type="button"
          onClick={() => {
            setShowCustom(false);
            setCustomValue('');
            onChange(0);
          }}
          className="text-xs text-muted-foreground underline whitespace-nowrap"
        >
          Use list
        </button>
      </div>
    );
  }

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => {
        if (e.target.value === 'custom') {
          setShowCustom(true);
          setCustomValue('');
        } else {
          onChange(parseInt(e.target.value, 10) || 0);
        }
      }}
      className={selectClass}
    >
      {Array.from({ length: 10 }, (_, i) => (
        <option key={i} value={i}>{i}</option>
      ))}
      <option value="custom">Other…</option>
    </select>
  );
}

export const WorkLogForm = React.memo<WorkLogFormProps>(({ onSubmit, initialProject }) => {
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
    updateDwgRefs,
    updateWeather,
    seedFromPrevious,
    clearSeed,
    resetForm,
  } = useWorkLogForm(initialProject);

  const [prefilledFrom, setPrefilledFrom] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const prefillAttemptedFor = useRef<Set<string>>(new Set());

  const roleSuggestions = useSuggestions('personnel.role', formData.project);
  const equipmentTypeSuggestions = useSuggestions('equipment.type', formData.project);
  const materialNameSuggestions = useSuggestions('materials.name', formData.project);
  const materialUnitSuggestions = useSuggestions('materials.unit', formData.project);

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

  const selectedProject = useMemo(() => {
    return projects.find(project => project._id?.toString() === formData.project);
  }, [projects, formData.project]);

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

  useEffect(() => {
    if (toast) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  }, [toast]);

  // Pre-fill personnel/equipment/materials/weather from this user's most recent
  // log on the same project. Only runs when the form is still pristine for those
  // fields, and only once per (projectId) per mount.
  const projectId = formData.project;
  const formIsPristineForSeed =
    formData.personnel.length === 0 &&
    formData.equipment.length === 0 &&
    formData.materials.length === 0 &&
    !formData.weather;

  useEffect(() => {
    if (!projectId) return;
    if (prefillAttemptedFor.current.has(projectId)) return;
    if (!formIsPristineForSeed) return;

    prefillAttemptedFor.current.add(projectId);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/worklogs/last?project=${encodeURIComponent(projectId)}`);
        if (!res.ok) return;
        const last = await res.json();
        if (cancelled || !last) return;

        const hasSeed =
          (last.personnel?.length ?? 0) > 0 ||
          (last.equipment?.length ?? 0) > 0 ||
          (last.materials?.length ?? 0) > 0 ||
          !!last.weather;
        if (!hasSeed) return;

        seedFromPrevious({
          weather: last.weather,
          temperature: last.temperature,
          personnel: last.personnel ?? [],
          equipment: last.equipment ?? [],
          materials: last.materials ?? [],
        });
        setPrefilledFrom(typeof last.date === 'string' ? last.date : new Date(last.date).toISOString());
      } catch (err) {
        console.error('Pre-fill from last worklog failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, formIsPristineForSeed, seedFromPrevious]);

  const dismissPrefill = useCallback(() => {
    clearSeed();
    setPrefilledFrom(null);
  }, [clearSeed]);

  useEffect(() => {
    setDuplicateError(null);
  }, [formData.date, formData.project]);

  const checkDuplicateWorkLog = useCallback(async () => {
    if (!isOnline || !formData.project || !formData.date) {
      return false;
    }

    const params = new URLSearchParams({
      project: formData.project,
      date: formData.date,
    });

    const response = await fetch(`/api/worklogs?${params.toString()}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return false;
    }

    const result = await response.json();
    if (result.exists) {
      setDuplicateError(DUPLICATE_WORKLOG_MESSAGE);
      showError(DUPLICATE_WORKLOG_MESSAGE, TOAST_DURATION.MEDIUM);
      return true;
    }

    setDuplicateError(null);
    return false;
  }, [formData.date, formData.project, isOnline, showError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!onSubmit) {
      console.warn('WorkLogForm: onSubmit prop is not provided.');
      return;
    }

    try {
      const isDuplicate = await checkDuplicateWorkLog();
      if (isDuplicate) {
        return;
      }

      await submitWorkLog({
        onlineSubmit: onSubmit,
        formData,
      });
      resetForm();
      setDuplicateError(null);
      setPrefilledFrom(null);
      prefillAttemptedFor.current.clear();
    } catch (error) {
      // Error already handled by useOfflineSync
      console.error('Form submission error:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
     
      {prefilledFrom && (
        <Alert variant="info">
          <span>
            Copied from your log on{' '}
            <strong>
              {new Date(prefilledFrom).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </strong>
            .
          </span>{' '}
          <button
            type="button"
            onClick={dismissPrefill}
            className="font-medium underline ml-1"
          >
            Start blank
          </button>
        </Alert>
      )}

      <FormSection step={1} title="Details" description="Date, project, conditions, and the day's work">
      <FormField label="Date" htmlFor="date" required>
        <input
          type="date"
          id="date"
          name="date"
          value={formData.date}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-input bg-background shadow-sm focus:border-ring focus:ring-ring sm:text-sm"
          required
        />
      </FormField>

      <FormField label="Project" htmlFor="project" required>
        <select
          id="project"
          name="project"
          value={formData.project}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-input bg-background shadow-sm focus:border-ring focus:ring-ring sm:text-sm"
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
        <WeatherPicker
          value={formData.weather || ''}
          onChange={updateWeather}
        />
      </FormField>

      <FormField label="Temperature (°C)" htmlFor="temperature">
        <input
          type="number"
          id="temperature"
          name="temperature"
          value={formData.temperature || ''}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-input bg-background shadow-sm focus:border-ring focus:ring-ring sm:text-sm"
        />
      </FormField>

      <FormField label="Work Description" htmlFor="workDescription" required>
        <textarea
          id="workDescription"
          name="workDescription"
          value={formData.workDescription}
          onChange={handleChange}
          rows={3}
          className="mt-1 block w-full rounded-md border-input bg-background shadow-sm focus:border-ring focus:ring-ring sm:text-sm"
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
          className="mt-1 block w-full rounded-md border-input bg-background shadow-sm focus:border-ring focus:ring-ring sm:text-sm"
        />
      </FormField>
      </FormSection>

      <FormSection step={2} title="Resources" description="Personnel, equipment, and materials on site">
      <ArrayField
        title="Personnel"
        items={formData.personnel}
        onAdd={personnel.add}
        onRemove={personnel.remove}
        addButtonText="Add Personnel"
        renderFields={(item, index) => (
          <div className="grid grid-cols-2 gap-4 pr-8">
            <FormField label="Role" htmlFor={`personnel-role-${index}`}>
              <Combobox
                id={`personnel-role-${index}`}
                value={item.role}
                onChange={(v) => personnel.update(index, 'role', v)}
                suggestions={roleSuggestions}
                placeholder="e.g. Εργάτης"
              />
            </FormField>
            <FormField label="Count" htmlFor={`personnel-count-${index}`}>
              <PersonnelCountField
                id={`personnel-count-${index}`}
                value={item.count}
                onChange={(n) => personnel.update(index, 'count', n)}
              />
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
              <Combobox
                id={`equipment-type-${index}`}
                value={item.type}
                onChange={(v) => equipment.update(index, 'type', v)}
                suggestions={equipmentTypeSuggestions}
                placeholder="e.g. Εκσκαφέας"
              />
            </FormField>
            <FormField label="Count" htmlFor={`equipment-count-${index}`}>
              <input
                type="number"
                id={`equipment-count-${index}`}
                value={item.count}
                onChange={(e) => equipment.update(index, 'count', parseInt(e.target.value) || 0)}
                min="1"
                className="mt-1 block w-full rounded-md border-input bg-background shadow-sm focus:border-ring focus:ring-ring sm:text-sm"
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
                className="mt-1 block w-full rounded-md border-input bg-background shadow-sm focus:border-ring focus:ring-ring sm:text-sm"
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
              <Combobox
                id={`material-name-${index}`}
                value={item.name}
                onChange={(v) => materials.update(index, 'name', v)}
                suggestions={materialNameSuggestions}
                placeholder="e.g. Σκυρόδεμα"
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
                className="mt-1 block w-full rounded-md border-input bg-background shadow-sm focus:border-ring focus:ring-ring sm:text-sm"
              />
            </FormField>
            <FormField label="Unit" htmlFor={`material-unit-${index}`}>
              <Combobox
                id={`material-unit-${index}`}
                value={item.unit}
                onChange={(v) => materials.update(index, 'unit', v)}
                suggestions={materialUnitSuggestions}
                placeholder="m³, kg, τεμ., m², ώρες"
              />
            </FormField>
          </div>
        )}
      />
      </FormSection>

      <FormSection step={3} title="Attachments" description="Site photos and referenced drawings">
      <PhotoUpload
        value={formData.images}
        onChange={updateImages}
      />

      <DwgPicker
        projectId={formData.project}
        value={formData.dwgRefs}
        onChange={updateDwgRefs}
      />
      </FormSection>

      <FormSection step={4} title="Signatures" description="Sign off the day's record">
      <SignatureSection
        signatures={formData.signatures || []}
        onChange={updateSignatures}
        projectOwnerUserId={selectedProject?.ownerUserId?.toString()}
        projectContractorUserId={selectedProject?.contractorUserId?.toString()}
      />
      </FormSection>

      <Button type="submit" size="lg" className="w-full">
        Submit Work Log
      </Button>
    </form>
  );
});
