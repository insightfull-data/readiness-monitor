import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, createAuditLog } from '@/lib/auth'
import { generateRumeltStrategy } from '@/lib/rumelt'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth()
    const { notes, aiSummary } = await req.json()
    const runId = params.id

    const run = await prisma.scoreRun.findUnique({
      where: { id: runId },
      include: {
        checkResults: true,
        dataset: true,
        useCase: true,
      },
    })

    if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })

    // Generate Rumelt strategy from check results
    const checks = run.checkResults.map(c => ({
      checkName: c.checkName,
      weight: c.weight,
      score: c.score,
      status: c.status as 'pass' | 'warn' | 'fail',
      finding: c.finding,
    }))

    const strategy = generateRumeltStrategy(
      run.overallScore,
      checks,
      run.dataset.period,
      run.dataset.sourceSystem
    )

    // Deactivate all existing active reports
    await prisma.publicReport.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    })

    // Create new public report
    const report = await prisma.publicReport.create({
      data: {
        scoreRunId: runId,
        period: run.dataset.period,
        publishedBy: session.user.id,
        isActive: true,
        diagnosis: strategy.diagnosis,
        guidingPolicy: strategy.guidingPolicy,
        coherentActions: strategy.coherentActions,
        permittedUse: strategy.permittedUse,
        aiSummary: aiSummary || run.aiSummary || null,
      },
    })

    // Update run status and notes
    await prisma.scoreRun.update({
      where: { id: runId },
      data: { status: 'published', analystNotes: notes || null },
    })

    // Update use case status
    await prisma.useCase.update({
      where: { id: run.useCaseId },
      data: { status: 'published' },
    })

    await createAuditLog(
      session.user.id,
      'PUBLISH_REPORT',
      'PublicReport',
      report.id,
      `Published ${run.dataset.period} — score ${run.overallScore} (${run.band})`
    )

    return NextResponse.json({ reportId: report.id })
  } catch (e) {
    console.error(e)
    if ((e as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Publish failed' }, { status: 500 })
  }
}
