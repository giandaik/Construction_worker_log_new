"use client"

import { Suspense } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter, useSearchParams } from 'next/navigation'
import { Toaster } from '@/components/ui/toaster'
import { WorkLogForm } from '@/components/WorkLogForm'
import { getWorkLogStatusFromSignatures } from '@/lib/signatureUtils'

function NewWorkLogFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialProject = searchParams.get('project') || ''

  const handleSubmit = async (data: any) => {
    const status = getWorkLogStatusFromSignatures(
      Array.isArray(data.signatures) ? data.signatures : []
    )

    const response = await fetch('/api/worklogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, status }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to create work log')
    }

    router.push('/worklogs')
  }

  return (
    <div className="container mx-auto px-3 py-4 sm:px-4">
      <Toaster />
      <Card>
        <CardHeader>
          <CardTitle>New Work Log Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkLogForm onSubmit={handleSubmit} initialProject={initialProject} />
        </CardContent>
      </Card>
    </div>
  )
}

export default function NewWorkLogForm() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-3 py-4 sm:px-4">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading form...</p>
        </div>
      </div>
    }>
      <NewWorkLogFormContent />
    </Suspense>
  )
}
