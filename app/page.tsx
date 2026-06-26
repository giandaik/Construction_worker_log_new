import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FileText, Plus, FolderOpen, ArrowRight } from "lucide-react"
import { PendingSubmissions } from "@/components/PendingSubmissions"
import { dbConnect } from "@/lib/dbConnect"
import mongoose from "mongoose"
import type { Project, WorkLog } from "@/types/shared"
import { WorkerActionRow } from "@/components/WorkerActionRow"
import { getAuthUser } from "@/utils/auth"
import { FORM_STATUS_LABELS, FORM_STATUS_CLASSES } from "@/lib/constants/constantValues"

const RECENT_LOGS_SHOWN = 6

interface DashboardWorkLog extends Omit<WorkLog, '_id' | 'project'> {
  _id: string
  project: string
  status?: string
}

interface DashboardProject extends Omit<Project, '_id'> {
  _id: string
}

async function getInitialData() {
  try {
    await dbConnect();
    const db = mongoose.connection;

    const [projects, workLogs, totalLogs] = await Promise.all([
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
          status: 1,
          createdAt: 1,
          updatedAt: 1
        }
      })
        .sort({ date: -1 })
        .limit(50)
        .toArray(),
      db.collection('worklogs').countDocuments(),
    ]);

    const typedProjects: DashboardProject[] = projects.map(project => ({
      _id: project._id.toString(),
      name: project.name,
      description: project.description
    }));

    const typedWorkLogs: DashboardWorkLog[] = workLogs.map(log => ({
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
      status: log.status,
      createdAt: log.createdAt,
      updatedAt: log.updatedAt
    }));

    return {
      projects: typedProjects,
      workLogs: typedWorkLogs,
      totalLogs,
    };
  } catch (error) {
    console.error("Error fetching initial data:", error);
    return {
      projects: [],
      workLogs: [],
      totalLogs: 0,
    };
  }
}

function StatCard({ label, value, hint, href }: { label: string; value: string; hint?: string; href?: string }) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-md border bg-card p-4 transition-shadow hover:shadow-md hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {body}
      </Link>
    )
  }

  return (
    <div className="rounded-md border bg-card p-4 transition-shadow hover:shadow-md">
      {body}
    </div>
  )
}

export default async function HomePage() {
  const [initialData, authUser] = await Promise.all([
    getInitialData(),
    getAuthUser(),
  ]);
  const isWorker = authUser?.role === 'user';

  const { projects, workLogs, totalLogs } = initialData;
  const recentLogs = workLogs.slice(0, RECENT_LOGS_SHOWN);
  const projectNames = new Map(projects.map((p) => [p._id, p.name]));
  const lastEntry = workLogs[0]?.date
    ? new Date(workLogs[0].date).toLocaleDateString()
    : '—';

  return (
    <div className="flex flex-col min-h-screen">
      <main className="container flex-1 px-4 py-8 md:px-6">
        {isWorker && authUser ? (
          <WorkerActionRow userId={authUser.userId} />
        ) : (
          <section className="animate-fade-up grid gap-4 sm:grid-cols-3">
            <StatCard label="Work logs" value={String(totalLogs)} hint={`Last entry ${lastEntry}`} href="/worklogs" />
            <StatCard label="Projects" value={String(projects.length)} href="/projects" />
            <StatCard
              label="Quick start"
              value="New log"
              hint="Record today's work in minutes"
              href="/logs/new"
            />
          </section>
        )}

        <section className="mt-10 grid gap-8 lg:grid-cols-3">
          <div className="animate-fade-up lg:col-span-2" style={{ animationDelay: '80ms' }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold uppercase">Recent work logs</h2>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/worklogs">
                  All logs <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            {recentLogs.length === 0 ? (
              <div className="rounded-md border border-dashed bg-card p-10 text-center">
                <FileText className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
                <p className="mt-3 text-muted-foreground">No work logs yet.</p>
                <Button className="mt-4" asChild>
                  <Link href="/logs/new">
                    <Plus className="mr-2 h-4 w-4" /> Create the first one
                  </Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y rounded-md border bg-card">
                {recentLogs.map((log) => (
                  <li key={log._id}>
                    <Link
                      href={`/worklogs/${log._id}`}
                      className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {projectNames.get(log.project) ?? 'Unknown project'}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {log.workDescription}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {log.status && (
                          <span
                            className={`status-badge hidden sm:inline-flex ${
                              FORM_STATUS_CLASSES[log.status as keyof typeof FORM_STATUS_CLASSES] ?? 'status-unknown'
                            }`}
                          >
                            {FORM_STATUS_LABELS[log.status as keyof typeof FORM_STATUS_LABELS] ?? 'N/A'}
                          </span>
                        )}
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {new Date(log.date).toLocaleDateString()}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="animate-fade-up space-y-8" style={{ animationDelay: '160ms' }}>
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold uppercase">Projects</h2>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/projects">
                    All <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              {projects.length === 0 ? (
                <div className="rounded-md border border-dashed bg-card p-8 text-center">
                  <FolderOpen className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
                  <p className="mt-3 text-muted-foreground">No projects yet.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {projects.slice(0, 5).map((project) => (
                    <li key={project._id}>
                      <Link
                        href={`/projects/${project._id}`}
                        className="block rounded-md border bg-card px-4 py-3 transition-colors hover:bg-accent/50"
                      >
                        <p className="truncate font-medium">{project.name}</p>
                        {project.description && (
                          <p className="truncate text-sm text-muted-foreground">{project.description}</p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <PendingSubmissions initialData={{ projects, workLogs }} />
          </div>
        </section>
      </main>
    </div>
  )
}
