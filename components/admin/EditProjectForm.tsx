"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ProjectStatus = "planned" | "in-progress" | "completed" | "on-hold";

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "in-progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "on-hold", label: "On hold" },
];

/** Convert an ISO/date value to the `yyyy-MM-dd` string an <input type="date"> expects. */
function toDateInputValue(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function EditProjectForm({ projectId }: { projectId: string }) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [contractorEmail, setContractorEmail] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planned");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadProject() {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (!res.ok) throw new Error("Failed to load project");
        const project = await res.json();
        if (!active) return;
        setName(project.name ?? "");
        setDescription(project.description ?? "");
        setLocation(project.location ?? "");
        setOwnerEmail(project.ownerEmail ?? "");
        setContractorEmail(project.contractorEmail ?? "");
        setStatus((project.status as ProjectStatus) ?? "planned");
        setStartDate(toDateInputValue(project.startDate));
        setEndDate(toDateInputValue(project.endDate));
      } catch {
        if (active) setLoadError("Failed to load project");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadProject();
    return () => {
      active = false;
    };
  }, [projectId]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSuccess(null);

    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          location: location || undefined,
          ownerEmail,
          contractorEmail,
          status,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update project");
      }

      setSuccess(`Saved changes to "${name}"`);
      router.refresh();
      router.push(`/projects/${projectId}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update project");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Edit project</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-destructive">{loadError}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit project</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-location">Location</Label>
            <Input
              id="project-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="project-start-date">Start date</Label>
              <Input
                id="project-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-end-date">End date</Label>
              <Input
                id="project-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-owner-email">Owner email</Label>
            <Input
              id="project-owner-email"
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Must match the email of an existing user account.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-contractor-email">Contractor email</Label>
            <Input
              id="project-contractor-email"
              type="email"
              value={contractorEmail}
              onChange={(e) => setContractorEmail(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Must match the email of an existing user account.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-status">Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as ProjectStatus)}>
              <SelectTrigger id="project-status" aria-label="Project status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}
          {success && <p className="text-sm text-success">{success}</p>}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
