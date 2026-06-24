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
import { LocationPicker } from "@/components/projects/LocationPicker";
import { CatalogFields } from "@/components/projects/CatalogFields";
import { CatalogImportDialog } from "@/components/projects/CatalogImportDialog";
import {
  totalCatalogCount,
  type ProjectCatalog,
} from "@/lib/catalog/mergeCatalog";
import type { CatalogKind } from "@/lib/schemas/projectSchema";

type ProjectStatus = "planned" | "in-progress" | "completed" | "on-hold";

function emptyCatalog(): ProjectCatalog {
  return {
    personnelRoles: [],
    equipmentTypes: [],
    materialNames: [],
    materialUnits: [],
  };
}

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
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [contractorEmail, setContractorEmail] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planned");
  const [catalog, setCatalog] = useState<ProjectCatalog>(emptyCatalog);
  const [showCatalog, setShowCatalog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleCoordinates(result: {
    latitude: number;
    longitude: number;
    address?: string | null;
  }) {
    setLatitude(result.latitude);
    setLongitude(result.longitude);
    const address = result.address;
    // Best-effort: only pre-fill the text label while the user hasn't typed one.
    if (address) {
      setLocation((prev) => prev || address);
    }
  }

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
          latitude: latitude ?? undefined,
          longitude: longitude ?? undefined,
          ownerEmail,
          contractorEmail,
          status,
          personnelRoles: catalog.personnelRoles,
          equipmentTypes: catalog.equipmentTypes,
          materialNames: catalog.materialNames,
          materialUnits: catalog.materialUnits,
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
      setLatitude(null);
      setLongitude(null);
      setOwnerEmail("");
      setContractorEmail("");
      setStatus("planned");
      setCatalog(emptyCatalog());
      setShowCatalog(false);
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
            <Label>Map location</Label>
            <LocationPicker
              latitude={latitude}
              longitude={longitude}
              onCoordinates={handleCoordinates}
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

          <div className="space-y-3 rounded-md border p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Κατάλογος επιλογών (προαιρετικό)</p>
                <p className="text-xs text-muted-foreground">
                  {totalCatalogCount(catalog) > 0
                    ? `${totalCatalogCount(catalog)} επιλογές έτοιμες`
                    : "Φέρε τις λίστες από άλλο project ή πρόσθεσέ τες αργότερα."}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCatalog((prev) => !prev)}
              >
                {showCatalog ? "Απόκρυψη" : "Επεξεργασία"}
              </Button>
            </div>

            <CatalogImportDialog
              mode="prefill"
              currentCatalog={catalog}
              onPrefill={(merged) => {
                setCatalog(merged);
                setShowCatalog(true);
              }}
            />

            {showCatalog && (
              <CatalogFields
                catalog={catalog}
                onChange={(kind: CatalogKind, values) =>
                  setCatalog((prev) => ({ ...prev, [kind]: values }))
                }
              />
            )}
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
