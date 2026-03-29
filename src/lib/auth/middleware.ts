import { NextRequest } from 'next/server'
import { verifySessionToken, SESSION_COOKIE_NAME } from './index'
import type { SessionPayload } from '@/types'

/**
 * Reads the session cookie from the request and verifies it.
 * Returns the session payload if valid, null otherwise.
 */
export async function getSessionFromRequest(
  request: NextRequest
): Promise<SessionPayload | null> {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)
  if (!cookie?.value) return null
  return verifySessionToken(cookie.value)
}
