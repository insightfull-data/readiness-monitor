import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { deleteSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const token = cookieStore.get('session')?.value
  if (token) await deleteSession(token)
  cookieStore.delete('session')
  return NextResponse.redirect(new URL('/login', req.url))
}
