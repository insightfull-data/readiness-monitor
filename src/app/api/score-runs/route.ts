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
      period, sourceSystem, extractedAt, lineageStatus, reviewerName, rowCount,
    } = body

    // Upsert use case
    const useCase = await prisma.useCase.create({
      data: {
        name: ucName || `Assessment — ${period}`,
        businessUnit: ucBu || 'Unknown',
        outputType: ucType || 'Sales trend summary',
        intendedUse: ucIntent || 'Internal use',
        status: 'draft',
      },
    })

    // Create dataset
    const dataset = await prisma.dataset.create({
      data: {
        useCaseId: useCase.id,
        filename: filename || 'upload.csv',
        period: period || 'Unknown',
        sourceSystem: sourceSystem || 'Unknown',
        rowCount: rowCount || null,
        extractedAt: extractedAt ? new Date(extractedAt) : null,
        lineageStatus: lineageStatus || 'none',
        reviewerName: reviewerName || null,
      },
    })

    // Parse CSV stats
    const csvStats = csvText
      ? parseCSVStats(csvText)
      : getDemoCSVStats()

    // Calculate days since extraction
    if (extractedAt) {
      const extracted = new Date(extractedAt)
      csvStats.daysSinceExtraction = Math.floor(
        (Date.now() - extracted.getTime()) / (1000 * 60 * 60 * 24)
      )
    }

    // Run checks
    const checks = runReadinessChecks({
      meta: {
        period: period || 'Unknown',
        sourceSystem: sourceSystem || 'Unknown',
        extractedAt: extractedAt ? new Date(extractedAt) : null,
        lineageStatus: (lineageStatus || 'none') as 'full' | 'partial' | 'none',
        reviewerName: reviewerName || null,
        rowCount: rowCount || null,
      },
      csv: csvStats,
    })

    const overallScore = calculateScore(checks)
    const band = getBand(overallScore)

    // Generate Rumelt strategy
    const strategy = generateRumeltStrategy(
      overallScore,
      checks,
      period || 'this period',
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
