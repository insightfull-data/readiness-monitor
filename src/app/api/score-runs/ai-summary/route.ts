import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MAX_CALLS_PER_DAY = 5
const MAX_CALLS_PER_RUN = 1

async function checkRateLimit(runId: string): Promise<{ allowed: boolean; reason?: string }> {
  const existingRun = await prisma.scoreRun.findUnique({
    where: { id: runId },
    select: { aiSummary: true },
  })
  if (existingRun?.aiSummary && MAX_CALLS_PER_RUN === 1) {
    return { allowed: false, reason: 'AI summary already generated for this run. Edit manually if needed.' }
  }
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const todayCount = await prisma.auditLog.count({
    where: { action: 'AI_SUMMARY_GENERATED', createdAt: { gte: startOfDay } },
  })
  if (todayCount >= MAX_CALLS_PER_DAY) {
    return {
      allowed: false,
      reason: `Daily AI call limit reached (${MAX_CALLS_PER_DAY}/day). Resets at midnight.`,
    }
  }
  return { allowed: true }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth()
    const { runId } = await req.json()

    const limit = await checkRateLimit(runId)
    if (!limit.allowed) {
      return NextResponse.json({ error: limit.reason }, { status: 429 })
    }

    const run = await prisma.scoreRun.findUnique({
      where: { id: runId },
      include: { checkResults: true, dataset: true, useCase: true },
    })
    if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })

    const checkSummary = run.checkResults
      .map(c => `${c.checkName} (${Math.round(c.weight * 100)}% weight, score ${c.score}/100, ${c.status}): ${c.finding}`)
      .join('\n')

    const bandLabel =
      run.band === 'ready' ? 'Ready' :
      run.band === 'usable' ? 'Usable with controls' :
      run.band === 'limited' ? 'Limited use' : 'Not ready'

    const prompt = `You are a senior data governance analyst writing a plain-language readiness summary for a business audience. Be direct, specific, and practical. No jargon. No bullet points.

Dataset: ${run.useCase.name}
Period: ${run.dataset.period}
Source system: ${run.dataset.sourceSystem}
Overall score: ${run.overallScore}/100 — Band: ${bandLabel}

Check results:
${checkSummary}

Write 3-4 sentences: (1) what the score means for this dataset specifically, (2) the 1-2 most important data issues and what they mean for AI-generated insights, (3) what the data can and cannot be used for this month. No bullet points. No mention of readiness score or band. Write as a trusted analyst briefing a non-technical leadership team.`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })

    const summary = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    await prisma.scoreRun.update({ where: { id: runId }, data: { aiSummary: summary } })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'AI_SUMMARY_GENERATED',
        entity: 'ScoreRun',
        entityId: runId,
        detail: `AI summary generated for ${run.dataset.period} — ${run.overallScore}/100`,
      },
    })

    return NextResponse.json({ summary })
  } catch (e) {
    console.error(e)
    if ((e as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 })
  }
}
