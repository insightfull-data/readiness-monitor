import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, createAuditLog } from '@/lib/auth'

export async function GET() {
  try {
    await requireAuth()
    const actions = await prisma.govAction.findMany({
      orderBy: { loggedAt: 'desc' },
      include: { logger: { select: { name: true } } },
    })
    return NextResponse.json(actions)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth()
    const { action, framework, notes, isPublic } = await req.json()

    if (!action || !framework || !notes?.trim()) {
      return NextResponse.json({ error: 'action, framework, and notes are required' }, { status: 400 })
    }

    const isNist = framework.includes('NIST') || framework.includes('Both')
    const isIso  = framework.includes('ISO')  || framework.includes('Both')

    const entry = await prisma.govAction.create({
      data: {
        loggedBy: session.user.id,
        action,
        framework,
        notes,
        nistPoints: isNist ? 1 : 0,
        isoPoints:  isIso  ? 1 : 0,
        isPublic: isPublic !== false,
      },
    })

    // Advance framework counters (capped at total)
    if (isNist) {
      const fw = await prisma.frameworkState.findUnique({ where: { framework: 'NIST' } })
      if (fw && fw.metCount < fw.totalCount) {
        await prisma.frameworkState.update({
          where: { framework: 'NIST' },
          data: { metCount: { increment: 1 } },
        })
      }
    }
    if (isIso) {
      const fw = await prisma.frameworkState.findUnique({ where: { framework: 'ISO' } })
      if (fw && fw.metCount < fw.totalCount) {
        await prisma.frameworkState.update({
          where: { framework: 'ISO' },
          data: { metCount: { increment: 1 } },
        })
      }
    }

    await createAuditLog(
      session.user.id,
      'LOG_GOV_ACTION',
      'GovAction',
      entry.id,
      `${action} — ${framework}`
    )

    return NextResponse.json(entry)
  } catch (e) {
    console.error(e)
    if ((e as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
