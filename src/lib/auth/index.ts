import { SignJWT, jwtVerify } from 'jose'
import type { MagicLinkPayload, SessionPayload, UserRole } from '@/types'

// Fail closed: never fall back to a hardcoded signing key. A missing secret in
// any environment would let anyone forge session/magic-link tokens (including
// an admin session), so refuse to start without them. The two token classes use
// independent secrets so a magic-link token can never be replayed as a session
// token, and vice versa. Set both in the environment (and in .env.local for
// local development).
const SESSION_SECRET_VALUE = process.env.NEXTAUTH_SECRET
if (!SESSION_SECRET_VALUE) {
  throw new Error(
    'NEXTAUTH_SECRET is not set. Refusing to start with an insecure default signing key. ' +
      'Set NEXTAUTH_SECRET (the session-token signing key) in the environment.'
  )
}

const MAGIC_LINK_SECRET_VALUE = process.env.MAGIC_LINK_SECRET
if (!MAGIC_LINK_SECRET_VALUE) {
  throw new Error(
    'MAGIC_LINK_SECRET is not set. Refusing to start with an insecure default signing key. ' +
      'Set MAGIC_LINK_SECRET (the magic-link-token signing key) in the environment.'
  )
}

const SESSION_SECRET = new TextEncoder().encode(SESSION_SECRET_VALUE)
const MAGIC_LINK_SECRET = new TextEncoder().encode(MAGIC_LINK_SECRET_VALUE)

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
