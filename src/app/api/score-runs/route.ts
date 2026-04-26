import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, createAuditLog } from '@/lib/auth'
import { runReadinessChecks, calculateScore, parseCSVStats, getDemoCSVStats } from '@/lib/scoring'
import { generateRumeltStrategy } from '@/lib/rumelt'
import { getBand } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await req.json()
    const {
      csvText, filename,
      ucName, ucBu, ucType, ucIntent,
      sourceSystem, lineageStatus, reviewerName, rowCount,
    } = body

    // Parse CSV stats — auto-detects dataset type and date range
    const csvStats = csvText ? parseCSVStats(csvText) : getDemoCSVStats()

    // Use detected period from CSV — fall back to 'Unknown' if no date column
    const period = csvStats.detectedPeriod || 'Unknown period'

    // Create use case
    const useCase = await prisma.useCase.create({
      data: {
        name: ucName || `Assessment — ${period}`,
        businessUnit: ucBu || 'Unknown',
        outputType: ucType || 'Sales trend summary',
        intendedUse: ucIntent || 'Internal use',
        status: 'draft',
      },
    })

    // Create dataset — no extractedAt, period comes from CSV
    const dataset = await prisma.dataset.create({
      data: {
        useCaseId: useCase.id,
        filename: filename || 'upload.csv',
        period,
        sourceSystem: sourceSystem || 'Unknown',
        rowCount: rowCount || csvStats.totalRows || null,
        extractedAt: null,
        lineageStatus: lineageStatus || 'none',
        reviewerName: reviewerName || null,
      },
    })

    // Run checks
    const checks = runReadinessChecks({
      meta: {
        period,
        sourceSystem: sourceSystem || 'Unknown',
        extractedAt: null,
        lineageStatus: (lineageStatus || 'none') as 'full' | 'partial' | 'none',
        reviewerName: reviewerName || null,
        rowCount: rowCount || csvStats.totalRows || null,
      },
      csv: csvStats,
    })

    const overallScore = calculateScore(checks)
    const band = getBand(overallScore)

    // Generate strategy narrative
    const strategy = generateRumeltStrategy(
      overallScore,
      checks,
      period,
      sourceSystem || 'the source system'
    )

    // Create score run
    const run = await prisma.scoreRun.create({
      data: {
        useCaseId: useCase.id,
        datasetId: dataset.id,
        runBy: session.user.id,
        overallScore,
        band,
        status: 'draft',
      },
    })

    // Create check results
    for (const c of checks) {
      await prisma.checkResult.create({
        data: {
          scoreRunId: run.id,
          checkName: c.checkName,
          weight: c.weight,
          score: c.score,
          status: c.status,
          finding: c.finding,
        },
      })
    }

    await createAuditLog(
      session.user.id,
      'RUN_ASSESSMENT',
      'ScoreRun',
      run.id,
      `Assessment run for ${period} — score ${overallScore} (${band})`
    )

    return NextResponse.json({
      runId: run.id,
      score: overallScore,
      band,
      period,
      datasetType: csvStats.datasetType,
      detectedPeriod: csvStats.detectedPeriod,
      checks,
      diagnosis: strategy.diagnosis,
      guidingPolicy: strategy.guidingPolicy,
      coherentActions: strategy.coherentActions,
      permittedUse: strategy.permittedUse,
    })
  } catch (e) {
    console.error(e)
    if ((e as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth()
    const runs = await prisma.scoreRun.findMany({
      orderBy: { runAt: 'desc' },
      take: 20,
      include: {
        dataset: { select: { period: true, sourceSystem: true } },
        useCase: { select: { name: true } },
      },
    })
    return NextResponse.json(runs)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
