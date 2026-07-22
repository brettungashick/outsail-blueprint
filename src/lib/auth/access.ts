// Project-scoped access control helpers.
//
// These centralize the row-level-security check that was previously copied
// (correctly) into some routes and (incorrectly) into others. The broken
// variants tested `members.some(() => true)` — i.e. "does this project have ANY
// member" — which is true for every populated project and lets any authenticated
// user act on any tenant's data. The correct check is "is THIS caller a member",
// which is what `isProjectMember` / `hasProjectAccess` encode.

/** True only if `userId` is one of the project's members. */
export function isProjectMember(
  members: Array<{ user_id: string }>,
  userId: string
): boolean {
  return members.some((m) => m.user_id === userId)
}

/**
 * Standard project access rule, matching the pattern already used in the
 * chat / discovery / invite-stakeholder routes: the project creator, a member
 * of the project, or an admin may act on it. Everyone else is denied.
 */
export function hasProjectAccess(
  project: { created_by: string | null },
  members: Array<{ user_id: string }>,
  session: { userId: string; role: string }
): boolean {
  return (
    project.created_by === session.userId ||
    isProjectMember(members, session.userId) ||
    session.role === 'admin'
  )
}

/**
 * A magic-link redemption may only mint a session for a user that already
 * exists (i.e. was explicitly invited/provisioned) and is still active.
 * Unknown emails are rejected — the app never auto-creates accounts on verify.
 */
export function canStartSession<T extends { is_active?: boolean | null }>(
  user: T | null | undefined
): user is T {
  return !!user && user.is_active !== false
}
