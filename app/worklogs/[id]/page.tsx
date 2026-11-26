"use client";

import { useState, useEffect, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {FileDown, Pencil, Trash, FileText, FileType2, CheckCircle, XCircle, MoreHorizontal} from "lucide-react";
import { Glyph } from "@/components/native/icons";
import { FORM_STATUS, FORM_STATUS_CLASSES, FORM_STATUS_LABELS, LABELS } from "@/lib/constants/constantValues";
import { WEATHER_OPTIONS } from "@/components/forms/WeatherPicker";
import { SignatureSection } from "@/components/SignatureSection";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useProjectRole } from "@/hooks/useProjectRole";
import { getWorkLogStatusFromSignatures } from "@/lib/signatureUtils";
import type { Signature } from "@/types/shared";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/toaster";
import { apiFetch } from "@/lib/apiClient";
import { isNativeBundle } from "@/lib/native-mode";
import {
  Btn,
  LargeTitle,
  Pill,
  Row,
  Section,
  Skeleton as NativeSkeleton,
} from "@/components/native/ui";
import { Sheet } from "@/components/native/controls";
import { useRouteId } from "@/lib/native-route";

/* ---------- Native (Capacitor) presentation helpers ---------- */

/** "Tuesday 24 November 2026" — the date line under the native large title. */
function longDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Short Greek label for the pill — the full signed label does not fit a 390 pt row. */
function nativeStatusLabel(status?: string): string {
  if (status === FORM_STATUS.SIGNED) return "Αναμονή";
  return FORM_STATUS_LABELS[status as keyof typeof FORM_STATUS_LABELS] ?? "N/A";
}

function nativeStatusTone(status?: string): "ok" | "warn" | "plan" | "draft" {
  if (status === FORM_STATUS.COMPLETED) return "ok";
  if (status === FORM_STATUS.SIGNED) return "warn";
  if (status === FORM_STATUS.PENDING) return "draft";
  return "draft";
}

/** A grouped property row: 15 pt secondary label, 17 pt value, wrap-safe. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Row
      title={<span className="t-subhead t-secondary">{label}</span>}
      trailing={<span className="max-w-[62%] text-right">{children}</span>}
    />
  );
}

const WEATHER_LABEL_MAP: Record<string, { label: string; Icon: typeof WEATHER_OPTIONS[number]['icon'] }> =
  Object.fromEntries(WEATHER_OPTIONS.map(({ key, label, icon }) => [key, { label, Icon: icon }]));

interface Personnel {
  role: string;
  count: number;
  workDetails: string;
}

interface Equipment {
  type: string;
  count: number;
  hours: number;
}

interface Material {
  name: string;
  quantity: number;
  unit: string;
}

interface ProjectInfo {
  ownerUserId?: string;
  contractorUserId?: string;
  ownerName?: string;
  contractorName?: string;
}

interface WorkLog {
  _id: string;
  date: string;
  project: string;
  projectName?: string;
  projectLocation?:string;
  author: string;
  authorName?: string;
  weather?: string;
  temperature?: number;
  workDescription: string;
  personnel?: Personnel[];
  equipment?: Equipment[];
  materials?: Material[];
  notes?: string;
  status?:string;
  signatures?: Signature[];
  images?: string[];
  dwgRefs?: string[];
  rejectionComment?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ProjectDwgFile {
  url: string;
  filename: string;
  size: number;
  pdfUrl?: string;
  pdfFilename?: string;
  pdfSize?: number;
}

export default function WorkLogDetailPage() {
  const router = useRouter();
  const id = useRouteId();
  const { user } = useCurrentUser();

  const [workLog, setWorkLog] = useState<WorkLog | null>(null);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [projectDwgFiles, setProjectDwgFiles] = useState<ProjectDwgFile[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [rejectionComment, setRejectionComment] = useState('');

  const projectRole = useProjectRole(
    user?.userId,
    projectInfo?.ownerUserId,
    projectInfo?.contractorUserId
  );

  useEffect(() => {
    // Native shell resolves the id from `?id=` after mount — don't fetch `/api/worklogs/`.
    if (!id) return;
    const fetchWorkLog = async () => {
      try {
        setIsLoading(true);
        const response = await apiFetch(`/api/worklogs/${id}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Work log not found');
          }
          throw new Error('Failed to fetch work log');
        }
        
        const data = await response.json();
        setWorkLog(data);
        setSignatures(data.signatures ?? []);

        if (data.project) {
          try {
            const projectRes = await apiFetch(`/api/projects/${data.project}`);
            if (projectRes.ok) {
              const project = await projectRes.json();
              setProjectInfo({
                ownerUserId: project.ownerUserId?.toString(),
                contractorUserId: project.contractorUserId?.toString(),
                ownerName: project.ownerName,
                contractorName: project.contractorName,
              });
              if (Array.isArray(data.dwgRefs) && data.dwgRefs.length > 0) {
                setProjectDwgFiles(project.dwgFiles ?? []);
              }
            }
          } catch (e) {
            console.error('Failed to fetch project:', e);
          }
        }

      } catch (error) {
        console.error('Error fetching work log:', error);
        setError(error instanceof Error ? error.message : 'Failed to load work log');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchWorkLog();
    }
  }, [id]);

  

  const handleExportPDF = async () => {
    if (!workLog) return;

    // Dynamically import the PDF export function
    const { exportToPDF } = await import('./exportToPDF');
    await exportToPDF(workLog);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this work log?')) {
      return;
    }

    try {
      const response = await apiFetch(`/api/worklogs/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete work log');
      }

      router.push('/worklogs');
    } catch (error) {
      console.error('Error deleting work log:', error);
      alert('Failed to delete work log');
    }
  };

  const hasOwnerSignature = signatures.some((signature) => signature.projectRole === 'owner');

  const handleApproveAndSign = async () => {
    if (!workLog) return;

    if (!hasOwnerSignature) {
      toast.error('Please add your signature before approving.');
      return;
    }

    try {
      setIsSubmitting(true);
      const status = getWorkLogStatusFromSignatures(
        signatures,
        projectInfo?.ownerName,
        projectInfo?.contractorName
      );

      const response = await apiFetch(`/api/worklogs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatures,
          status,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to approve work log');
      }

      const updated = await response.json();
      setWorkLog(updated);
      setSignatures(updated.signatures ?? []);
      toast.success('Work log approved and signed successfully');
    } catch (error) {
      console.error('Error approving work log:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to approve work log');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionComment.trim()) {
      toast.error('Please provide a rejection comment.');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await apiFetch(`/api/worklogs/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionComment: rejectionComment.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reject work log');
      }

      const updated = await response.json();
      setWorkLog(updated);
      setSignatures([]);
      setShowRejectDialog(false);
      setRejectionComment('');
      toast.success('Work log rejected and returned to draft');
    } catch (error) {
      console.error('Error rejecting work log:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to reject work log');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ------------------------------------------------------------------ *
   * Native presentation (Capacitor WebView). Same fetch, same handlers,
   * grouped iOS sections instead of a desktop card. The web branch below
   * is untouched.
   * ------------------------------------------------------------------ */
  if (isNativeBundle()) {
    if (isLoading) {
      return (
        <div className="pb-4">
          <LargeTitle sub="Loading…">Log</LargeTitle>
          <NativeSkeleton rows={4} />
        </div>
      );
    }

    if (error || !workLog) {
      return (
        <div className="pb-4">
          <LargeTitle>Log</LargeTitle>
          <Section title="Not available" icon="cloudOff">
            <div className="px-4 py-8 text-center">
              <p className="t-subhead t-secondary">{error || "Work log not found"}</p>
              <div className="mt-4 flex justify-center">
                <Btn variant="secondary" onClick={() => router.back()}>
                  Go back
                </Btn>
              </div>
            </div>
          </Section>
        </div>
      );
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/3 mb-2" />
            <Skeleton className="h-4 w-1/4" />
          </CardHeader>
          <CardContent className="space-y-8">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !workLog) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-destructive">{error || 'Work log not found'}</p>
            <Button onClick={() => router.back()} className="mt-4">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isCompleted = workLog.status === FORM_STATUS.COMPLETED;
  const isOwnerReviewMode =
    workLog.status === FORM_STATUS.SIGNED && projectRole === 'owner';

  if (isNativeBundle()) {
    const projectTitle = workLog.projectName || workLog.project || "Work log";
    const crewTotal = (workLog.personnel ?? []).reduce(
      (sum, person) => sum + (Number(person.count) || 0),
      0
    );
    const weather = workLog.weather ? WEATHER_LABEL_MAP[workLog.weather] : undefined;
    const images = workLog.images ?? [];
    const drawings = workLog.dwgRefs ?? [];
    const signed = workLog.signatures ?? [];

    return (
      <>
        <div className="pb-[92px]">
          <LargeTitle
            sub={
              <span className="inline-flex flex-wrap items-center gap-2">
                <span>{longDate(workLog.date)}</span>
                <Pill tone={nativeStatusTone(workLog.status)}>
                  {nativeStatusLabel(workLog.status)}
                </Pill>
              </span>
            }
          >
            {projectTitle}
          </LargeTitle>

          <Section title="Date & site" icon="calendar">
            <Field label="Date">{longDate(workLog.date)}</Field>
            <Field label="Site">{projectTitle}</Field>
            {workLog.projectLocation ? (
              <Field label="Location">{workLog.projectLocation}</Field>
            ) : null}
            <Field label="Author">{workLog.authorName || workLog.author || "Unknown"}</Field>
          </Section>

          {workLog.weather || typeof workLog.temperature === "number" ? (
            <Section title="Conditions" icon="weather">
              {workLog.weather ? (
                <Field label="Weather">
                  {weather ? (
                    <span className="inline-flex items-center gap-1.5">
                      <weather.Icon className="h-4 w-4" aria-hidden />
                      <span>{weather.label}</span>
                    </span>
                  ) : (
                    workLog.weather
                  )}
                </Field>
              ) : null}
              {typeof workLog.temperature === "number" ? (
                <Field label="Temperature">{workLog.temperature} °C</Field>
              ) : null}
            </Section>
          ) : null}

          <Section title="Work done" icon="pen">
            <div className="px-4 py-3">
              <p className="t-body whitespace-pre-wrap">
                {workLog.workDescription || "No description"}
              </p>
            </div>
            {workLog.notes ? (
              <>
                <div className="ml-4 h-[0.5px] bg-[color:var(--ios-sep)]" />
                <div className="px-4 py-3">
                  <div className="t-subhead t-secondary">Notes</div>
                  <p className="t-body mt-1 whitespace-pre-wrap">{workLog.notes}</p>
                </div>
              </>
            ) : null}
          </Section>

          {workLog.personnel && workLog.personnel.length > 0 ? (
            <Section title={`Crew · ${crewTotal}`} icon="users">
              {workLog.personnel.map((person, index) => (
                <Row
                  key={index}
                  title={<span className="font-semibold">{person.role || "N/A"}</span>}
                  subtitle={person.workDetails || undefined}
                  trailing={
                    <span className="t-body shrink-0 tabular-nums text-[color:var(--ios-ink2)]">
                      ×{person.count}
                    </span>
                  }
                />
              ))}
            </Section>
          ) : null}

          {workLog.equipment && workLog.equipment.length > 0 ? (
            <Section title={`Equipment · ${workLog.equipment.length}`} icon="truck">
              {workLog.equipment.map((item, index) => (
                <Row
                  key={index}
                  title={item.type || "N/A"}
                  trailing={
                    <span className="t-body shrink-0 tabular-nums text-[color:var(--ios-ink2)]">
                      {item.count} × · {item.hours} h
                    </span>
                  }
                />
              ))}
            </Section>
          ) : null}

          {workLog.materials && workLog.materials.length > 0 ? (
            <Section title={`Materials · ${workLog.materials.length}`} icon="box">
              {workLog.materials.map((material, index) => (
                <Row
                  key={index}
                  title={material.name || "N/A"}
                  trailing={
                    <span className="t-body shrink-0 tabular-nums text-[color:var(--ios-ink2)]">
                      {material.quantity} {material.unit}
                    </span>
                  }
                />
              ))}
            </Section>
          ) : null}

          {images.length > 0 ? (
            <Section title={`Photos · ${images.length}`} icon="camera">
              <div className="grid grid-cols-3 gap-1 p-2">
                {images.map((src, index) => (
                  <a
                    key={index}
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative block aspect-square overflow-hidden rounded-[6px] bg-[rgba(120,120,128,.12)]"
                  >
                    <Image
                      src={src}
                      alt={`Photo ${index + 1}`}
                      fill
                      sizes="(max-width: 430px) 30vw, 120px"
                      className="object-cover"
                    />
                  </a>
                ))}
              </div>
            </Section>
          ) : null}

          {drawings.length > 0 ? (
            <Section title={`Drawings · ${drawings.length}`} icon="pen">
              {drawings.map((url) => {
                const meta = projectDwgFiles.find((file) => file.url === url);
                const filename = meta?.filename ?? url.split("/").pop() ?? "drawing.dwg";
                return (
                  <Row
                    key={url}
                    title={<span className="block truncate">{filename}</span>}
                    subtitle={meta ? undefined : "No longer available"}
                    trailing={
                      <span className="flex shrink-0 items-center gap-1">
                        {meta?.pdfUrl ? (
                          <a
                            href={meta.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ios-tap inline-flex items-center px-1 text-[15px] font-semibold text-[color:var(--ios-tint)]"
                          >
                            PDF
                          </a>
                        ) : null}
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ios-tap inline-flex items-center px-1 text-[15px] font-semibold text-[color:var(--ios-tint)]"
                        >
                          DWG
                        </a>
                      </span>
                    }
                  />
                );
              })}
            </Section>
          ) : null}

          {workLog.rejectionComment ? (
            <Section title="Rejection comment" icon="x">
              <div className="px-4 py-3">
                <p className="t-body whitespace-pre-wrap">{workLog.rejectionComment}</p>
              </div>
            </Section>
          ) : null}

          <Section title="Signatures" icon="shield">
            {isOwnerReviewMode ? (
              <div className="px-3 py-3">
                <SignatureSection
                  signatures={signatures}
                  onChange={setSignatures}
                  projectOwnerUserId={projectInfo?.ownerUserId}
                  projectContractorUserId={projectInfo?.contractorUserId}
                  allowDraftSignatureRemoval={false}
                />
              </div>
            ) : signed.length > 0 ? (
              signed.map((signature, index) => (
                <Row
                  key={index}
                  title={<span className="font-semibold">{signature.signedBy}</span>}
                  subtitle={`${signature.projectRole || "N/A"} · ${new Date(
                    signature.signedAt
                  ).toLocaleString()}`}
                >
                  <img
                    src={signature.data}
                    alt={`Signature by ${signature.signedBy}`}
                    className="mt-2 h-auto max-h-32 w-auto max-w-full"
                  />
                </Row>
              ))
            ) : (
              <div className="flex items-center gap-2 px-4 py-3 text-[color:var(--ios-ink2)]">
                <Glyph name="shield" size={18} className="shrink-0" />
                <p className="t-subhead">Not signed yet.</p>
              </div>
            )}
          </Section>

          <p className="t-footnote t-secondary mt-4 px-4">
            Created{" "}
            {workLog.createdAt ? new Date(workLog.createdAt).toLocaleString() : "unknown"}
          </p>
        </div>

        <div
          className="ios-above-tabbar fixed inset-x-0 z-30 border-t bg-[color:var(--ios-card)]/95 backdrop-blur-xl"
          style={{ borderColor: "var(--ios-sep)" }}
        >
          <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-2">
            <div className="min-w-0 flex-1">
              {isOwnerReviewMode ? (
                <Btn
                  block
                  onClick={handleApproveAndSign}
                  disabled={isSubmitting || !hasOwnerSignature}
                >
                  <Glyph name="check" size={19} /> Approve &amp; sign
                </Btn>
              ) : !isCompleted ? (
                <Btn block href={`/worklogs/${id}/edit`}>
                  <Glyph name="pen" size={19} /> Edit
                </Btn>
              ) : (
                <Btn block variant="secondary" onClick={handleExportPDF}>
                  <Glyph name="doc" size={19} /> Export PDF
                </Btn>
              )}
            </div>
            <button
              type="button"
              aria-label="More actions"
              onClick={() => setShowActions(true)}
              className="ios-tap flex shrink-0 items-center justify-center rounded-[12px] bg-[rgba(118,118,128,.14)] px-3 text-[color:var(--ios-ink)]"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>
        </div>

        <Sheet open={showActions} onOpenChange={setShowActions} title="Log actions">
          <div className="mb-3 overflow-hidden rounded-[10px] bg-[color:var(--ios-card)] ios-hairline">
            <Row
              title="Export PDF"
              leading={<Glyph name="doc" size={19} />}
              onClick={() => {
                setShowActions(false);
                void handleExportPDF();
              }}
            />
            {!isCompleted && !isOwnerReviewMode ? (
              <Row
                title={<span className="text-destructive">Delete log</span>}
                leading={<Glyph name="x" size={19} />}
                onClick={() => {
                  setShowActions(false);
                  void handleDelete();
                }}
              />
            ) : null}
            {isOwnerReviewMode ? (
              <Row
                title={<span className="text-destructive">Reject log</span>}
                leading={<Glyph name="x" size={19} />}
                onClick={() => {
                  setShowActions(false);
                  setShowRejectDialog(true);
                }}
              />
            ) : null}
          </div>
        </Sheet>

        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Work Log</DialogTitle>
              <DialogDescription>
                Provide a comment explaining why this work log is being rejected. It will be
                returned to draft status for the contractor to revise.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={rejectionComment}
              onChange={(e) => setRejectionComment(e.target.value)}
              placeholder="Rejection comment..."
              rows={4}
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowRejectDialog(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={isSubmitting || !rejectionComment.trim()}
              >
                Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Toaster />
      </>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-6">
        <div className="flex flex-wrap gap-2">
          {isOwnerReviewMode ? (
            <>
              <Button
                onClick={handleApproveAndSign}
                disabled={isSubmitting || !hasOwnerSignature}
              >
                <CheckCircle className="mr-2 h-4 w-4" /> Approve and Sign
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowRejectDialog(true)}
                disabled={isSubmitting}
              >
                <XCircle className="mr-2 h-4 w-4" /> Reject
              </Button>
            </>
          ) : (
            <>
              {!isCompleted && (
                <Button variant="outline" asChild>
                  <Link href={`/worklogs/${id}/edit`}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                  </Link>
                </Button>
              )}
              {!isCompleted && (
                <Button variant="destructive" onClick={handleDelete}>
                  <Trash className="mr-2 h-4 w-4" /> Delete
                </Button>
              )}
            </>
          )}
          <Button variant="outline" onClick={handleExportPDF}>
              <FileDown className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Work Log</DialogTitle>
            <DialogDescription>
              Provide a comment explaining why this work log is being rejected. It will be returned to draft status for the contractor to revise.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectionComment}
            onChange={(e) => setRejectionComment(e.target.value)}
            placeholder="Rejection comment..."
            rows={4}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isSubmitting || !rejectionComment.trim()}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start w-full">
            <div>
              <CardTitle className="text-xl sm:text-2xl">
              <span>Work Log - {new Date(workLog.date).toLocaleDateString()}</span>
              </CardTitle>
              <CardDescription>
                Created: {workLog.createdAt ? new Date(workLog.createdAt).toLocaleString() : 'Unknown'}
              </CardDescription>
            </div>
            <span className={`status-badge self-start whitespace-nowrap ${FORM_STATUS_CLASSES[workLog.status as keyof typeof FORM_STATUS_CLASSES] ?? 'status-unknown'}`}>
              {FORM_STATUS_LABELS[workLog.status as keyof typeof FORM_STATUS_LABELS] ?? "N/A"}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p>{new Date(workLog.date).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Project</p>
                <p>{workLog.projectName || workLog.project || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Project Location</p>
                <p>{workLog.projectLocation || workLog.project || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Author</p>
                <p>{workLog.authorName || workLog.author || 'Unknown'}</p>
              </div>
              {workLog.weather && (
                <div>
                  <p className="text-sm text-muted-foreground">Weather</p>
                  {(() => {
                    const mapped = WEATHER_LABEL_MAP[workLog.weather];
                    if (mapped) {
                      const { label, Icon } = mapped;
                      return (
                        <p className="flex items-center gap-2">
                          <Icon className="h-4 w-4" aria-hidden />
                          <span>{label}</span>
                        </p>
                      );
                    }
                    return <p>{workLog.weather}</p>;
                  })()}
                </div>
              )}
              {typeof workLog.temperature === 'number' && (
                <div>
                  <p className="text-sm text-muted-foreground">Temperature</p>
                  <p>{workLog.temperature}°C</p>
                </div>
              )}
            </div>
          </div>

          {/* Work Description */}
          <div>
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">Work Description</h3>
            <p className="whitespace-pre-wrap">{workLog.workDescription}</p>
          </div> 

          {/* Personnel */}
          {workLog.personnel && workLog.personnel.length > 0 && (() => {
            const totalCount = workLog.personnel.reduce((sum, person) => sum + (Number(person.count) || 0),0);
            return (
              <div>
                <h3 className="text-lg font-semibold mb-4 border-b pb-2">
                  {LABELS.personnel} ({LABELS.total}: {totalCount})
                </h3>

                <div className="grid gap-4">
                  {workLog.personnel.map((person, index) => (
                    <div key={index} className="border rounded-md p-4 bg-muted/50">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">{LABELS.role}</p>
                          <strong>{person.role || 'N/A'}</strong>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">{LABELS.count}</p>
                          <p>{person.count}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">{LABELS.workDetails}</p>
                          <p>{person.workDetails}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Equipment */}
          {workLog.equipment && workLog.equipment.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 border-b pb-2">Equipment</h3>
              <div className="grid gap-4">
                {workLog.equipment.map((item, index) => (
                  <div key={index} className="border rounded-md p-4 bg-muted/50">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Type</p>
                        <p>{item.type || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Count</p>
                        <p>{item.count}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Hours</p>
                        <p>{item.hours}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Materials */}
          {workLog.materials && workLog.materials.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 border-b pb-2">Materials</h3>
              <div className="grid gap-4">
                {workLog.materials.map((material, index) => (
                  <div key={index} className="border rounded-md p-4 bg-muted/50">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Name</p>
                        <p>{material.name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Quantity</p>
                        <p>{material.quantity}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Unit</p>
                        <p>{material.unit || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Photos */}
          {workLog.images && workLog.images.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 border-b pb-2">Photos</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {workLog.images.map((src, index) => (
                  <a
                    key={index}
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative block aspect-square overflow-hidden rounded-md border bg-muted/50"
                  >
                    <Image
                      src={src}
                      alt={`Photo ${index + 1}`}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                      className="object-cover transition-transform hover:scale-105"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Drawings */}
          {workLog.dwgRefs && workLog.dwgRefs.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 border-b pb-2">Drawings</h3>
              <ul className="divide-y divide-border rounded-md border border-border">
                {workLog.dwgRefs.map((url) => {
                  const meta = projectDwgFiles.find((f) => f.url === url);
                  const filename = meta?.filename ?? url.split('/').pop() ?? 'drawing.dwg';
                  if (!meta) {
                    return (
                      <li key={url} className="flex items-center gap-3 px-3 py-2">
                        <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                          {filename} <span className="italic">(no longer available)</span>
                        </span>
                      </li>
                    );
                  }
                  return (
                    <li key={url} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <span className="min-w-0 truncate text-sm font-medium text-foreground">
                          {filename}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {meta.pdfUrl && (
                          <a
                            href={meta.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                          >
                            <FileType2 className="h-4 w-4" />
                            View PDF
                          </a>
                        )}
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-input bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50"
                        >
                          <FileDown className="h-4 w-4" />
                          Download DWG
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Notes */}
          {workLog.notes && (
            <div>
              <h3 className="text-lg font-semibold mb-4 border-b pb-2">Notes</h3>
              <p className="whitespace-pre-wrap">{workLog.notes}</p>
            </div>
          )}

          {/* Rejection comment */}
          {workLog.rejectionComment && (
            <div>
              <h3 className="text-lg font-semibold mb-4 border-b pb-2 text-destructive">
                Rejection Comment
              </h3>
              <p className="whitespace-pre-wrap rounded-md border border-destructive/30 bg-destructive/5 p-4">
                {workLog.rejectionComment}
              </p>
            </div>
          )}

          {/* Signatures */}
          {isOwnerReviewMode ? (
            <div>
              <h3 className="text-lg font-semibold mb-4 border-b pb-2">Signatures</h3>
              <SignatureSection
                signatures={signatures}
                onChange={setSignatures}
                projectOwnerUserId={projectInfo?.ownerUserId}
                projectContractorUserId={projectInfo?.contractorUserId}
                allowDraftSignatureRemoval={false}
              />
            </div>
          ) : (
            workLog.signatures && workLog.signatures.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 border-b pb-2">Signatures</h3>
              <div className="grid gap-6">
                {workLog.signatures.map((signature, index) => (
                  <div key={index} className="border rounded-lg p-4 bg-muted/50">
                    <div className="mb-4">
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-sm text-muted-foreground">Signed By</p>
                          <p className="font-semibold">{signature.signedBy}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Project Role</p>
                          <p>{signature.projectRole || 'N/A'}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Signed At</p>
                        <p>{new Date(signature.signedAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <p className="text-sm text-muted-foreground mb-2">Signature</p>
                      <div className="border rounded p-2 bg-card">
                        <img
                          src={signature.data}
                          alt={`Signature by ${signature.signedBy}`}
                          className="max-w-full h-auto max-h-48"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )
          )}
        </CardContent>
      </Card>
      <Toaster />
    </div>
  );
}
