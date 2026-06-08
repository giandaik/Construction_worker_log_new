import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FileText, Plus, FolderOpen } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { PendingSubmissions } from "@/components/PendingSubmissions"
import { dbConnect } from "@/lib/dbConnect"
import mongoose from "mongoose"
import type { Project, WorkLog } from "@/types/shared"
import { LogoutButton } from "@/components/LogoutButton"

async function getInitialData() {
  try {
    await dbConnect();
    const db = mongoose.connection;
    
    // Fetch all data in parallel with projections to reduce payload
    const [projects, workLogs] = await Promise.all([
      db.collection('projects').find({}, {
        projection: { _id: 1, name: 1, description: 1 }
      }).toArray(),
      db.collection('worklogs').find({}, {
        projection: {
          _id: 1,
          date: 1,
          project: 1,
          author: 1,
          workDescription: 1,
          createdAt: 1,
          updatedAt: 1
        }
      })
        .sort({ date: -1 })
        .limit(50)
        .toArray()
    ]);

    // Convert MongoDB documents to typed objects
    const typedProjects: Project[] = projects.map(project => ({
      _id: project._id.toString(),
      name: project.name,
      description: project.description
    }));

    const typedWorkLogs: WorkLog[] = workLogs.map(log => ({
      _id: log._id.toString(),
      date: log.date,
      project: log.project?.toString() || '',
      author: log.author?.toString() || '',
      workDescription: log.workDescription || '',
      personnel: log.personnel || [],
      equipment: log.equipment || [],
      materials: log.materials || [],
      weather: log.weather,
      temperature: log.temperature,
      notes: log.notes,
      createdAt: log.createdAt,
      updatedAt: log.updatedAt
    }));

    return {
      projects: typedProjects,
      workLogs: typedWorkLogs
    };
  } catch (error) {
    console.error("Error fetching initial data:", error);
    return {
      projects: [],
      workLogs: []
    };
  }
}

export default async function HomePage() {
  const initialData = await getInitialData();

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b">
        <div className="container flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-4">
          <h1 className="text-xl sm:text-2xl font-bold">Ημερολόγιο Εργασιών</h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <Button asChild>
              <Link href="/forms/new">
                <Plus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">New Form</span>
                <span className="sm:hidden">New</span>
              </Link>
            </Button>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>
      
      <main>
        <section className="py-8 sm:py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 items-center">
              <div className="space-y-4">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tighter md:text-4xl lg:text-5xl">
                  Digitize Your Construction Site Forms
                </h2>
                <p className="text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                  Transform paper forms into digital records. Track work progress, personnel, equipment, and materials
                  with ease.
                </p>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  {/* <Button asChild>
                    <Link href="/forms/new">
                      <Plus className="w-4 h-4 mr-2" />
                      Create New Form
                    </Link>
                  </Button> */}
                  <Button variant="outline" asChild>
                    <Link href="/projects">
                      <FolderOpen className="w-4 h-4 mr-2" />
                      View All Projects
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/worklogs">
                      <FileText className="w-4 h-4 mr-2" />
                      View All Forms
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="relative w-full max-w-md mx-auto lg:mx-0">
                <div className="p-4 bg-white border rounded-lg shadow-lg">
                  <div className="text-center p-2 bg-gray-100 rounded mb-4">
                    <h3 className="font-bold text-lg">ΗΜΕΡΟΛΟΓΙΟ ΕΡΓΑΣΙΩΝ</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-8 bg-gray-100 rounded"></div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-8 bg-gray-100 rounded"></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-8 bg-gray-100 rounded"></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-24 bg-gray-100 rounded"></div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-24 bg-gray-100 rounded"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        <section className="py-12">
          <div className="container px-4 md:px-6">
            <PendingSubmissions initialData={initialData} />
          </div>
        </section>
      </main>
      
      <footer className="border-t">
        <div className="container flex flex-col items-center justify-between gap-4 px-4 py-6 md:flex-row">
          <p className="text-sm text-gray-500">© 2024 ConstructionLog. All rights reserved.</p>
          <nav className="flex gap-4 text-sm">
            <Link href="#" className="text-gray-500 hover:underline">
              Terms
            </Link>
            <Link href="#" className="text-gray-500 hover:underline">
              Privacy
            </Link>
            <Link href="#" className="text-gray-500 hover:underline">
              Contact
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}

