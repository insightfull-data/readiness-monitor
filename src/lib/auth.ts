import { cookies } from 'next/headers'
import { prisma } from './prisma'

export async function getSession() {
  const cookieStore = cookies()
  const token = cookieStore.get('session')?.value
  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!session || session.expiresAt < new Date()) return null
  return session
}

export async function requireAuth() {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  return session
}

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  return prisma.session.create({
    data: { userId, expiresAt },
  })
}

export async function deleteSession(token: string) {
  await prisma.session.deleteMany({ where: { token } })
}

export async function createAuditLog(
  userId: string,
  action: string,
  entity: string,
  entityId?: string,
  detail?: string
) {
  return prisma.auditLog.create({
    data: { userId, action, entity, entityId, detail },
  })
}
