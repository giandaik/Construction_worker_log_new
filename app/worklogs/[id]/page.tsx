"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {ArrowLeft, FileDown, Pencil, Trash} from "lucide-react";
import { FORM_STATUS, FORM_STATUS_CLASSES, FORM_STATUS_LABELS, LABELS } from "@/lib/constants/constantValues";
import "../worklogs.css";

// Define a comprehensive WorkLog interface
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

interface Signature {
  data: string;
  signedBy: string;
  signedAt: string;
  projectRole?: string;
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
  createdAt?: string;
  updatedAt?: string;
}

export default function WorkLogDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;

  const [workLog, setWorkLog] = useState<WorkLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWorkLog = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/worklogs/${id}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Work log not found');
          }
          throw new Error('Failed to fetch work log');
        }
        
        const data = await response.json();
        setWorkLog(data);

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
      const response = await fetch(`/api/worklogs/${id}`, {
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

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        </div>
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
        <div className="mb-6">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        </div>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-red-500">{error || 'Work log not found'}</p>
            <Button onClick={() => router.back()} className="mt-4">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-6">
        <Button variant="ghost" className="self-start" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Work Logs
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={`/worklogs/${id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Link>
          </Button>
          <Button variant="outline" onClick={handleExportPDF}>
              <FileDown className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

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
            <span className={`work-log-status self-start whitespace-nowrap ${FORM_STATUS_CLASSES[workLog.status as keyof typeof FORM_STATUS_CLASSES]}`}>
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
                <p className="text-sm text-gray-500">Date</p>
                <p>{new Date(workLog.date).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Project</p>
                <p>{workLog.projectName || workLog.project || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Project Location</p>
                <p>{workLog.projectLocation || workLog.project || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Author</p>
                <p>{workLog.authorName || workLog.author || 'Unknown'}</p>
              </div>
              {workLog.weather && (
                <div>
                  <p className="text-sm text-gray-500">Weather</p>
                  <p>{workLog.weather}</p>
                </div>
              )}
              {typeof workLog.temperature === 'number' && (
                <div>
                  <p className="text-sm text-gray-500">Temperature</p>
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
                    <div key={index} className="border rounded-md p-4 bg-gray-50">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">{LABELS.role}</p>
                          <strong>{person.role || 'N/A'}</strong>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">{LABELS.count}</p>
                          <p>{person.count}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">{LABELS.workDetails}</p>
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
                  <div key={index} className="border rounded-md p-4 bg-gray-50">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Type</p>
                        <p>{item.type || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Count</p>
                        <p>{item.count}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Hours</p>
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
                  <div key={index} className="border rounded-md p-4 bg-gray-50">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Name</p>
                        <p>{material.name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Quantity</p>
                        <p>{material.quantity}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Unit</p>
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
                    className="relative block aspect-square overflow-hidden rounded-md border bg-gray-50"
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

          {/* Notes */}
          {workLog.notes && (
            <div>
              <h3 className="text-lg font-semibold mb-4 border-b pb-2">Notes</h3>
              <p className="whitespace-pre-wrap">{workLog.notes}</p>
            </div>
          )}

          {/* Signatures */}
          {workLog.signatures && workLog.signatures.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 border-b pb-2">Signatures</h3>
              <div className="grid gap-6">
                {workLog.signatures.map((signature, index) => (
                  <div key={index} className="border rounded-lg p-4 bg-gray-50">
                    <div className="mb-4">
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-sm text-gray-500">Signed By</p>
                          <p className="font-semibold">{signature.signedBy}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Project Role</p>
                          <p>{signature.projectRole || 'N/A'}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Signed At</p>
                        <p>{new Date(signature.signedAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <p className="text-sm text-gray-500 mb-2">Signature</p>
                      <div className="border rounded p-2 bg-white">
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
          )}
        </CardContent>
      </Card>
    </div>
  );
} 