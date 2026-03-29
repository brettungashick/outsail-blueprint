import { SignJWT, jwtVerify } from 'jose'
import type { MagicLinkPayload, SessionPayload, UserRole } from '@/types'

const MAGIC_LINK_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? 'fallback-dev-secret-change-in-production'
)

const SESSION_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? 'fallback-dev-secret-change-in-production'
)

// ----------------------------------------------------------------
// Magic link token — 15-minute expiry
// ----------------------------------------------------------------
export async function createMagicToken(email: string): Promise<string> {
  const payload: MagicLinkPayload = { email, type: 'magic-link' }
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(MAGIC_LINK_SECRET)
}

export async function verifyMagicToken(
  token: string
): Promise<MagicLinkPayload | null> {
  try {
    const { payload } = await jwtVerify(token, MAGIC_LINK_SECRET)
    if (payload.type !== 'magic-link' || typeof payload.email !== 'string') {
      return null
    }
    return { email: payload.email, type: 'magic-link' }
  } catch {
    return null
  }
}

// ----------------------------------------------------------------
// Session token — 30-day expiry
// ----------------------------------------------------------------
export async function createSessionToken(
  userId: string,
  email: string,
  role: UserRole
): Promise<string> {
  const payload: SessionPayload = { userId, email, role }
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(SESSION_SECRET)
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SESSION_SECRET)
    if (
      typeof payload.userId !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.role !== 'string'
    ) {
      return null
    }
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role as UserRole,
    }
  } catch {
    return null
  }
}

// ----------------------------------------------------------------
// Cookie name constant
// ----------------------------------------------------------------
export const SESSION_COOKIE_NAME = 'outsail_session'
