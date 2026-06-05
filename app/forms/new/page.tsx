"use client"

import { useEffect, useState, useRef, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { fetchProjects, fetchUsers, createProject, createUser, ProjectWithId, UserWithId } from '@/lib/data-fetchers'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { PlusCircle, ArrowLeft, Trash2 } from "lucide-react"
import { addPendingWorkLog } from '@/lib/indexedDBHelper'
import { v4 as uuidv4 } from 'uuid'
import { Toaster } from '@/components/ui/toaster'
import mongoose from 'mongoose'
import { SignatureSection } from '@/components/SignatureSection'
import type { Signature } from '@/types/shared'
import { workLogSchema, WorkLogFormData, DEFAULT_PERSONNEL, DEFAULT_EQUIPMENT, DEFAULT_MATERIAL } from '@/lib/schemas/workLogSchema'
import { PERSONNEL_ROLES, LABELS } from '@/lib/constants/constantValues'
function NewWorkLogFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const [projects, setProjects] = useState<ProjectWithId[]>([])
  const [users, setUsers] = useState<UserWithId[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [signatures, setSignatures] = useState<Signature[]>([])

  // New state for the add project/user dialogs
  const [newProject, setNewProject] = useState({ name: '', description: '', location: '' })
  const [newUser, setNewUser] = useState({ name: '', email: '' })
  const [isAddingProject, setIsAddingProject] = useState(false)
  const [isAddingUser, setIsAddingUser] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    control,
  } = useForm<WorkLogFormData>({
    resolver: zodResolver(workLogSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      personnel: PERSONNEL_ROLES.map((role) => ({
        role,         // set each row's default role
        count: 0,
        workDetails: "",
      })),
      equipment: [DEFAULT_EQUIPMENT],
      materials: [DEFAULT_MATERIAL]
    }
  })

  // Add refs for dialog handling
  const projectDialogCloseRef = useRef<HTMLButtonElement>(null)
  const userDialogCloseRef = useRef<HTMLButtonElement>(null)

  const { fields, append, remove } = useFieldArray({
    control,
    name: "personnel",
  });

  const personnelValues = watch("personnel") || [];
  const totalCount = personnelValues.reduce((sum, p) => sum + (p.count || 0), 0);


  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch projects and users data
        const projectsData = await fetchProjects()
        const usersData = await fetchUsers()

        setProjects(projectsData)
        setUsers(usersData)

        // Get pre-selected project from URL (e.g., /forms/new?project=123)
        const projectFromUrl = searchParams.get('project')

        // Set default project: prefer URL param if valid; otherwise first project
        if (projectsData.length > 0 && !watch('project')) {
          if (projectFromUrl) {
            const exists = projectsData.some(p => p._id === projectFromUrl)
            if (exists) {
              setValue('project', projectFromUrl)
            } else {
              setValue('project', projectsData[0]._id)
            }
          } else {
            setValue('project', projectsData[0]._id)
          }
        }

        // Set default author based on session or first user if available
        if (session?.user?.email) {
          const currentUser = usersData.find((user: UserWithId) =>
            user.email === session.user?.email
          )
          if (currentUser) {
            setValue('author', currentUser._id)
          } else if (usersData.length > 0) {
            setValue('author', usersData[0]._id)
          }
        } else if (usersData.length > 0 && !watch('author')) {
          setValue('author', usersData[0]._id)
        }

        setIsLoading(false)
      } catch (error) {
        console.error('Error loading data:', error)
        toast.error('Failed to load form data')
        setIsLoading(false)
      }
    }

    loadData()
  }, [session, setValue, watch, searchParams])

  // Add debug output to check state updates
  useEffect(() => {
    console.log('Projects updated:', projects)
  }, [projects])

  useEffect(() => {
    console.log('Users updated:', users)
  }, [users])

  useEffect(() => {
    // Check initial online status
    setIsOnline(navigator.onLine);

    // Add event listeners for online/offline status
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Connection restored');
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('You are offline. Submissions will be saved locally.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

      if (isOnline) {
        // Online submission
        const status = signatures.length > 0 ? 'signed' : 'pending'

        const response = await fetch('/api/worklogs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...data,
            signatures,
            status
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to create work log')
        }

        toast.success('Work log created successfully', {
          duration: 3000,
          position: 'top-center'
        })
        router.push('/worklogs')
      } else {
        // Offline submission
        const tempId = uuidv4();
        const status = signatures.length > 0 ? 'signed' : 'pending'

        const pendingData = {
          tempId,
          date: data.date,
          project: data.project, // Keep as string for offline storage
          author: data.author,
          workDescription: data.workDescription,
          weather: data.weather,
          temperature: data.temperature,
          personnel: data.personnel?.map(p => ({
            role: p.role,
            count: p.count
          })) || [],
          equipment: data.equipment?.map(e => ({
            type: e.type,
            count: e.count,
            hours: e.hours
          })) || [],
          materials: data.materials?.map(m => ({
            name: m.name,
            quantity: m.quantity,
            unit: m.unit
          })) || [],
          notes: data.notes,
          signatures: signatures,
          status
        };

        await addPendingWorkLog(pendingData);

        // Show toast and wait for it to be displayed
        await new Promise(resolve => {
          toast.success('Work log saved locally. It will be synced when online.', {
            duration: 3000,
            position: 'top-center',
            onAutoClose: resolve
          });
        });

        // After toast is shown, try to navigate
        try {
          await router.push('/worklogs');
        } catch (err) {
          console.log('Router push failed, falling back to window.location');
          window.location.href = '/worklogs';
        }
      }
    } catch (error) {
      console.error('Error creating work log:', error)
      setSubmitError(error instanceof Error ? error.message : 'Failed to create work log')
      toast.error('Failed to create work log', {
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

  const removeEquipment = (index: number) => {
    const currentEquipment = watch('equipment') || [];
    const newEquipment = currentEquipment.filter((_, i) => i !== index);
    setValue('equipment', newEquipment);
  };

  const addMaterial = () => {
    const currentMaterials = watch('materials') || []
    setValue('materials', [...currentMaterials, DEFAULT_MATERIAL])
  }

  const removeMaterial = (index: number) => {
    const currentMaterials = watch('materials') || [];
    const newMaterials = currentMaterials.filter((_, i) => i !== index);
    setValue('materials', newMaterials);
  };

  const handleAddProject = async () => {
    try {
      setIsAddingProject(true)

      // Use the helper function instead of direct fetch
      const createdProject = await createProject(newProject)

      if (!createdProject) {
        throw new Error('Failed to create project')
      }

      console.log('Created project:', createdProject)

      // Add the new project to the list and select it
      setProjects(prevProjects => [...prevProjects, createdProject])
      setValue('project', createdProject._id)

      // Reset the form
      setNewProject({ name: '', description: '', location: '' })
      toast.success('Project created successfully')

      // Close the dialog programmatically
      projectDialogCloseRef.current?.click()
    } catch (error) {
      console.error('Error creating project:', error)
      toast.error('Failed to create project')
    } finally {
      setIsAddingProject(false)
    }
  }

  const handleAddUser = async () => {
    try {
      setIsAddingUser(true)

      // Use the helper function instead of direct fetch
      const createdUser = await createUser(newUser)

      if (!createdUser) {
        throw new Error('Failed to create user')
      }

      console.log('Created user:', createdUser)

      // Add the new user to the list and select it
      setUsers(prevUsers => [...prevUsers, createdUser])
      setValue('author', createdUser._id)

      // Reset the form
      setNewUser({ name: '', email: '' })
      toast.success('User created successfully')

      // Close the dialog programmatically
      userDialogCloseRef.current?.click()
    } catch (error) {
      console.error('Error creating user:', error)
      toast.error('Failed to create user')
    } finally {
      setIsAddingUser(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        </div>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Loading form...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <Toaster />
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>New Work Log Entry</CardTitle>
            {!isOnline && (
              <div className="flex items-center text-yellow-600">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm">Offline Mode</span>
              </div>
            )}
          </div>
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
                  <div className="flex space-x-2">
                    <div className="flex-1">
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
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" type="button" size="icon" className="h-10 w-10">
                          <PlusCircle className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add New Project</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div>
                            <Label htmlFor="projectName">Name</Label>
                            <Input
                              id="projectName"
                              value={newProject.name}
                              onChange={(e) => setNewProject({...newProject, name: e.target.value})}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="projectDescription">Description</Label>
                            <Textarea
                              id="projectDescription"
                              value={newProject.description}
                              onChange={(e) => setNewProject({...newProject, description: e.target.value})}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="projectLocation">Location</Label>
                            <Input
                              id="projectLocation"
                              value={newProject.location}
                              onChange={(e) => setNewProject({...newProject, location: e.target.value})}
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => {
                            setNewProject({ name: '', description: '', location: '' })
                          }}>Cancel</Button>
                          <Button
                            type="button"
                            onClick={handleAddProject}
                            disabled={isAddingProject || !newProject.name}
                          >
                            {isAddingProject ? 'Creating...' : 'Create Project'}
                          </Button>
                          <DialogClose ref={projectDialogCloseRef} className="hidden" />
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                  {errors.project && <p className="text-red-500">{errors.project.message}</p>}
                </div>

                <div>
                  <Label htmlFor="projectLocation">Project Location</Label>
                  <Input
                    id="projectLocation"
                    value={
                      projects.find((project) => project._id === watch('project'))?.location || ''
                    }
                    readOnly
                    placeholder="Project location will appear here"
                    disabled
                  />
                </div>

                <div>
                  <Label htmlFor="author">Author</Label>
                  <div className="flex space-x-2">
                    <div className="flex-1">
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
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" type="button" size="icon" className="h-10 w-10">
                          <PlusCircle className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add New User</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div>
                            <Label htmlFor="userName">Name</Label>
                            <Input
                              id="userName"
                              value={newUser.name}
                              onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="userEmail">Email</Label>
                            <Input
                              id="userEmail"
                              type="email"
                              value={newUser.email}
                              onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => {
                            setNewUser({ name: '', email: '' })
                          }}>Cancel</Button>
                          <Button
                            type="button"
                            onClick={handleAddUser}
                            disabled={isAddingUser || !newUser.name || !newUser.email}
                          >
                            {isAddingUser ? 'Creating...' : 'Create User'}
                          </Button>
                          <DialogClose ref={userDialogCloseRef} className="hidden" />
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
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
              <h2 className="text-xl font-semibold mb-4 border-b pb-2">{LABELS.personnel} ({LABELS.total}: {totalCount})</h2>
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="relative grid grid-cols-3 gap-4 p-4 border rounded-md bg-gray-50 dark:bg-gray-800">
                     <button
                        type="button"
                        onClick={() => remove(index)}
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700 font-bold"
                      >
                        <Trash2 size={16} />
                    </button>
                    <div>
                      <Label>{LABELS.role}</Label>
                      <Input
                        placeholder={LABELS.role}
                        {...register(`personnel.${index}.role`)}
                      />
                    </div>
                    <div>
                      <Label>{LABELS.count}</Label>
                      <Input
                        type="number"
                        placeholder={LABELS.count}
                        {...register(`personnel.${index}.count`, { valueAsNumber: true })}
                      />
                    </div>
                    <div>
                      <Label>{LABELS.workDetails}</Label>
                      <Input
                        placeholder={LABELS.details}
                        {...register(`personnel.${index}.workDetails`)}
                      />
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addPersonnel} className="mt-2">
                  {LABELS.addPersonnel}
                </Button>
              </div>
            </div>

            {/* Equipment Section */}
            <div>
              <h2 className="text-xl font-semibold mb-4 border-b pb-2">Equipment</h2>
              <div className="space-y-4">
                {watch('equipment')?.map((_, index) => (
                  <div key={index} className="relative grid grid-cols-3 gap-4 p-4 border rounded-md bg-gray-50 dark:bg-gray-800">
                    <button
                        type="button"
                        onClick={() => removeEquipment(index)}
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700 font-bold"
                      >
                        <Trash2 size={16} />
                    </button>
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
                  <div key={index} className="relative grid grid-cols-3 gap-4 p-4 border rounded-md bg-gray-50 dark:bg-gray-800">
                    <button
                        type="button"
                        onClick={() => removeMaterial(index)}
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700 font-bold"
                      >
                        <Trash2 size={16} />
                    </button>
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

            {/* Signatures Section */}
            <div>
              <h2 className="text-xl font-semibold mb-4 border-b pb-2">Signatures</h2>
              <SignatureSection
                signatures={signatures}
                onChange={setSignatures}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin mr-2">⟳</span>
                  Saving...
                </>
              ) : 'Submit Work Log'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function NewWorkLogForm() {
  return (
    <Suspense fallback={
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <Button variant="ghost" disabled>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        </div>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Loading form...</p>
        </div>
      </div>
    }>
      <NewWorkLogFormContent />
    </Suspense>
  );
}
