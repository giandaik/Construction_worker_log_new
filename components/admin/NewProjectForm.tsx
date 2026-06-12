"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export function NewProjectForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [contractorEmail, setContractorEmail] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planned");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSuccess(null);

    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          location: location || undefined,
          ownerEmail,
          contractorEmail,
          status,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create project");
      }

      const project = await res.json();
      setSuccess(`Created project "${name}"`);
      setName("");
      setDescription("");
      setLocation("");
      setOwnerEmail("");
      setContractorEmail("");
      setStatus("planned");
      router.refresh();
      if (project?._id) {
        router.push(`/projects/${project._id}`);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New project</CardTitle>
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
            {submitting ? "Creating…" : "Create project"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
