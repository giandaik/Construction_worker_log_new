import Link from "next/link"
import { ArrowRight, FileText, Pencil, Plus } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import mongoose from "mongoose"
import { dbConnect } from "@/lib/dbConnect"

interface DraftSummary {
  _id: string
  projectName: string
  updatedAt: Date
}

interface RecentLogSummary {
  _id: string
  projectName: string
  date: Date
}

async function getWorkerActionData(userId: string): Promise<{
  draft: DraftSummary | null
  recent: RecentLogSummary | null
}> {
  try {
    await dbConnect()
    const db = mongoose.connection
    const authorId = new mongoose.Types.ObjectId(userId)

    const [draftDoc, recentDoc] = await Promise.all([
      db.collection('worklogs').findOne(
        { author: authorId, status: 'pending' },
        { sort: { updatedAt: -1 }, projection: { _id: 1, project: 1, updatedAt: 1 } }
      ),
      db.collection('worklogs').findOne(
        { author: authorId, status: { $ne: 'pending' } },
        { sort: { date: -1 }, projection: { _id: 1, project: 1, date: 1 } }
      ),
    ])

    const projectIds = [draftDoc?.project, recentDoc?.project].filter(Boolean) as mongoose.Types.ObjectId[]
    const projects = projectIds.length
      ? await db.collection('projects').find(
          { _id: { $in: projectIds } },
          { projection: { _id: 1, name: 1 } }
        ).toArray()
      : []
    const projectNames = new Map(projects.map(p => [p._id.toString(), p.name as string]))

    return {
      draft: draftDoc ? {
        _id: draftDoc._id.toString(),
        projectName: projectNames.get(draftDoc.project.toString()) ?? 'Unknown project',
        updatedAt: draftDoc.updatedAt,
      } : null,
      recent: recentDoc ? {
        _id: recentDoc._id.toString(),
        projectName: projectNames.get(recentDoc.project.toString()) ?? 'Unknown project',
        date: recentDoc.date,
      } : null,
    }
  } catch (error) {
    console.error('Error fetching worker action data:', error)
    return { draft: null, recent: null }
  }
}

function timeAgo(date: Date): string {
  const ms = Date.now() - new Date(date).getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}

function ActionCard({ href, icon: Icon, label, value, hint }: {
  href: string
  icon: LucideIcon
  label: string
  value: string
  hint?: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-md border bg-card p-4 transition-shadow hover:shadow-md hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="h-8 w-8 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="truncate font-display text-lg font-bold">{value}</p>
        {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
      <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  )
}

export async function WorkerActionRow({ userId }: { userId: string }) {
  const { draft, recent } = await getWorkerActionData(userId)

  const primary = draft ? (
    <ActionCard
      key="draft"
      href={`/worklogs/${draft._id}/edit`}
      icon={Pencil}
      label="Continue draft"
      value={draft.projectName}
      hint={`Saved ${timeAgo(draft.updatedAt)}`}
    />
  ) : (
    <ActionCard
      key="new"
      href="/logs/new"
      icon={Plus}
      label="Start today's log"
      value="New work log"
      hint="Record today's work"
    />
  )

  const secondary = recent ? (
    <ActionCard
      key="recent"
      href={`/worklogs/${recent._id}`}
      icon={FileText}
      label="Last submitted log"
      value={recent.projectName}
      hint={new Date(recent.date).toLocaleDateString()}
    />
  ) : null

  return (
    <section className={`animate-fade-up grid gap-4 ${secondary ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
      {primary}
      {secondary}
    </section>
  )
}
