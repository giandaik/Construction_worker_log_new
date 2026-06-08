"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { fetchProjects, fetchUsers, ProjectWithId, UserWithId } from '@/lib/data-fetchers'
import { ArrowLeft } from "lucide-react"
import { Toaster } from '@/components/ui/toaster'
import { SignatureSection } from '@/components/SignatureSection'
import { PhotoUpload } from '@/components/forms/PhotoUpload'
import type { Signature } from '@/types/shared'
import { Skeleton } from "@/components/ui/skeleton"
import { workLogSchema, WorkLogFormData, DEFAULT_PERSONNEL, DEFAULT_EQUIPMENT, DEFAULT_MATERIAL } from '@/lib/schemas/workLogSchema'
import { dataUrlToBlob, isDataUrl, uploadImageBlob } from '@/lib/imageResize'

export default function EditWorkLogForm() {
  const params = useParams()
  const router = useRouter()
  const { id } = params

  const [projects, setProjects] = useState<ProjectWithId[]>([])
  const [users, setUsers] = useState<UserWithId[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [images, setImages] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset
  } = useForm<WorkLogFormData>({
    resolver: zodResolver(workLogSchema),
    defaultValues: {
      personnel: [],
      equipment: [],
      materials: []
    }
  })

  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch projects and users data
        const [projectsData, usersData, workLogResponse] = await Promise.all([
          fetchProjects(),
          fetchUsers(),
          fetch(`/api/worklogs/${id}`)
        ])

        if (!workLogResponse.ok) {
          throw new Error('Failed to fetch work log')
        }

        const workLog = await workLogResponse.json()

        setProjects(projectsData)
        setUsers(usersData)

        // Populate form with existing work log data
        reset({
          date: workLog.date.split('T')[0],
          project: workLog.project,
          author: workLog.author,
          weather: workLog.weather || '',
          temperature: workLog.temperature,
          workDescription: workLog.workDescription,
          personnel: workLog.personnel || [],
          equipment: workLog.equipment || [],
          materials: workLog.materials || [],
          notes: workLog.notes || ''
        })

        // Set signatures if they exist
        if (workLog.signatures) {
          setSignatures(workLog.signatures)
        }

        // Set images if they exist
        if (Array.isArray(workLog.images)) {
          setImages(workLog.images)
        }

        setIsLoading(false)
      } catch (error) {
        console.error('Error loading data:', error)
        toast.error('Failed to load work log data')
        setIsLoading(false)
      }
    }

    if (id) {
      loadData()
    }
  }, [id, reset])

  const onSubmit = async (data: WorkLogFormData) => {
    try {
      setSubmitError(null)

      // Validate required fields
      if (!data.project) {
        setSubmitError('Project is required. Please select a project.')
        return
      }

      if (!data.author) {
        setSubmitError('Author is required. Please select an author.')
        return
      }

      // Set status based on whether signatures exist
      const status = signatures.length > 0 ? 'signed' : 'pending'

      // Upload any pending (base64) images before saving
      const resolvedImages: string[] = []
      for (const entry of images) {
        if (isDataUrl(entry)) {
          resolvedImages.push(await uploadImageBlob(dataUrlToBlob(entry)))
        } else {
          resolvedImages.push(entry)
        }
      }

      const response = await fetch(`/api/worklogs/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          signatures,
          images: resolvedImages,
          status
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update work log')
      }

      toast.success('Work log updated successfully', {
        duration: 3000,
        position: 'top-center'
      })
      router.push(`/worklogs/${id}`)
    } catch (error) {
      console.error('Error updating work log:', error)
      setSubmitError(error instanceof Error ? error.message : 'Failed to update work log')
      toast.error('Failed to update work log', {
        duration: 3000,
        position: 'top-center'
      })
    }
  }

  const addPersonnel = () => {
    const currentPersonnel = watch('personnel') || []
    setValue('personnel', [...currentPersonnel, DEFAULT_PERSONNEL])
  }

  const addEquipment = () => {
    const currentEquipment = watch('equipment') || []
    setValue('equipment', [...currentEquipment, DEFAULT_EQUIPMENT])
  }

  const addMaterial = () => {
    const currentMaterials = watch('materials') || []
    setValue('materials', [...currentMaterials, DEFAULT_MATERIAL])
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-3 py-4 sm:px-4">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/3 mb-2" />
          </CardHeader>
          <CardContent className="space-y-8">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-3 py-4 sm:px-4">
      <Toaster />
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Edit Work Log Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Basic Information Section */}
            <div>
              <h2 className="text-xl font-semibold mb-4 border-b pb-2">Basic Information</h2>

              {submitError && (
                <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 mb-4">
                  <p>{submitError}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    {...register('date')}
                  />
                  {errors.date && <p className="text-red-500">{errors.date.message}</p>}
                </div>

                <div>
                  <Label htmlFor="project">Project</Label>
                  <Select
                    onValueChange={(value) => setValue('project', value)}
                    value={watch('project') || ''}
                    required
                  >
                    <SelectTrigger id="project" className={errors.project ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.length > 0 ? (
                        <>
                          {projects.map((project) => (
                            <SelectItem key={project._id} value={project._id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </>
                      ) : (
                        <SelectItem value="no-projects" disabled>No projects available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {errors.project && <p className="text-red-500">{errors.project.message}</p>}
                </div>

                <div>
                  <Label htmlFor="author">Author</Label>
                  <Select
                    onValueChange={(value) => setValue('author', value)}
                    value={watch('author') || ''}
                    required
                  >
                    <SelectTrigger id="author" className={errors.author ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select author" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.length > 0 ? (
                        <>
                          {users.map((user) => (
                            <SelectItem key={user._id} value={user._id}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </>
                      ) : (
                        <SelectItem value="no-users" disabled>No users available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {errors.author && <p className="text-red-500">{errors.author.message}</p>}
                </div>

                <div>
                  <Label htmlFor="weather">Weather</Label>
                  <Input
                    id="weather"
                    {...register('weather')}
                  />
                  {errors.weather && <p className="text-red-500">{errors.weather.message}</p>}
                </div>

                <div>
                  <Label htmlFor="temperature">Temperature (°C)</Label>
                  <Input
                    id="temperature"
                    type="number"
                    {...register('temperature', { valueAsNumber: true })}
                  />
                  {errors.temperature && <p className="text-red-500">{errors.temperature.message}</p>}
                </div>
              </div>
            </div>

            {/* Work Description Section */}
            <div>
              <h2 className="text-xl font-semibold mb-4 border-b pb-2">Work Description</h2>
              <div>
                <Label htmlFor="workDescription">Details</Label>
                <Textarea
                  id="workDescription"
                  {...register('workDescription')}
                  rows={4}
                />
                {errors.workDescription && <p className="text-red-500">{errors.workDescription.message}</p>}
              </div>
            </div>

            {/* Personnel Section */}
            <div>
              <h2 className="text-xl font-semibold mb-4 border-b pb-2">Personnel</h2>
              <div className="space-y-4">
                {watch('personnel')?.map((_, index) => (
                  <div key={index} className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 border rounded-md bg-gray-50">
                    <div>
                      <Label>Role</Label>
                      <Input
                        placeholder="Role"
                        {...register(`personnel.${index}.role`)}
                      />
                    </div>
                    <div>
                      <Label>Count</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        {...register(`personnel.${index}.count`, { valueAsNumber: true })}
                      >
                        {Array.from({ length: 10 }, (_, i) => (
                          <option key={i} value={i}>{i}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Work Details</Label>
                      <Input
                        placeholder="Work Details"
                        {...register(`personnel.${index}.workDetails`)}
                      />
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addPersonnel} className="mt-2">
                  Add Personnel
                </Button>
              </div>
            </div>

            {/* Equipment Section */}
            <div>
              <h2 className="text-xl font-semibold mb-4 border-b pb-2">Equipment</h2>
              <div className="space-y-4">
                {watch('equipment')?.map((_, index) => (
                  <div key={index} className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 border rounded-md bg-gray-50">
                    <div>
                      <Label>Type</Label>
                      <Input
                        placeholder="Type"
                        {...register(`equipment.${index}.type`)}
                      />
                    </div>
                    <div>
                      <Label>Count</Label>
                      <Input
                        type="number"
                        placeholder="Count"
                        {...register(`equipment.${index}.count`, { valueAsNumber: true })}
                      />
                    </div>
                    <div>
                      <Label>Hours</Label>
                      <Input
                        type="number"
                        placeholder="Hours"
                        {...register(`equipment.${index}.hours`, { valueAsNumber: true })}
                      />
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addEquipment} className="mt-2">
                  Add Equipment
                </Button>
              </div>
            </div>

            {/* Materials Section */}
            <div>
              <h2 className="text-xl font-semibold mb-4 border-b pb-2">Materials</h2>
              <div className="space-y-4">
                {watch('materials')?.map((_, index) => (
                  <div key={index} className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 border rounded-md bg-gray-50">
                    <div>
                      <Label>Name</Label>
                      <Input
                        placeholder="Name"
                        {...register(`materials.${index}.name`)}
                      />
                    </div>
                    <div>
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        placeholder="Quantity"
                        {...register(`materials.${index}.quantity`, { valueAsNumber: true })}
                      />
                    </div>
                    <div>
                      <Label>Unit</Label>
                      <Input
                        placeholder="Unit"
                        {...register(`materials.${index}.unit`)}
                      />
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addMaterial} className="mt-2">
                  Add Material
                </Button>
              </div>
            </div>

            {/* Notes Section */}
            <div>
              <h2 className="text-xl font-semibold mb-4 border-b pb-2">Additional Notes</h2>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  {...register('notes')}
                  rows={3}
                />
                {errors.notes && <p className="text-red-500">{errors.notes.message}</p>}
              </div>
            </div>

            {/* Photos Section */}
            <div>
              <h2 className="text-xl font-semibold mb-4 border-b pb-2">Photos</h2>
              <PhotoUpload value={images} onChange={setImages} />
            </div>

            {/* Signatures Section */}
            <div>
              <h2 className="text-xl font-semibold mb-4 border-b pb-2">Signatures</h2>
              <SignatureSection
                signatures={signatures}
                onChange={setSignatures}
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-4">
              <Button
                type="button"
                variant="outline"
                className="sm:w-auto"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="sm:flex-1"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin mr-2">⟳</span>
                    Saving...
                  </>
                ) : 'Update Work Log'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
