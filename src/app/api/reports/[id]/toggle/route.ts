import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, createAuditLog } from '@/lib/auth'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth()
    const report = await prisma.publicReport.findUnique({ where: { id: params.id } })
    if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (!report.isActive) {
      // Publishing — deactivate all others first
      await prisma.publicReport.updateMany({ where: { isActive: true }, data: { isActive: false } })
      await prisma.publicReport.update({ where: { id: params.id }, data: { isActive: true } })
      await createAuditLog(session.user.id, 'PUBLISH_REPORT', 'PublicReport', params.id, `Published report for ${report.period}`)
    } else {
      await prisma.publicReport.update({ where: { id: params.id }, data: { isActive: false } })
      await createAuditLog(session.user.id, 'UNPUBLISH_REPORT', 'PublicReport', params.id, `Unpublished report for ${report.period}`)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    if ((e as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
