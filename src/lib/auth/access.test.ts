import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isProjectMember, hasProjectAccess, canStartSession } from './access.ts'

// ── C3: cross-tenant IDOR denial ────────────────────────────────────────────
// The bug this replaces: `members.some(() => true)` returned true whenever the
// project had ANY member, so a user who belonged to a different project passed.

test('isProjectMember denies a user who is not in the member list', () => {
  const members = [{ user_id: 'alice' }, { user_id: 'bob' }]
  assert.equal(isProjectMember(members, 'mallory'), false)
})

test('isProjectMember is false for an empty member list', () => {
  assert.equal(isProjectMember([], 'alice'), false)
})

test('isProjectMember allows an actual member', () => {
  assert.equal(isProjectMember([{ user_id: 'alice' }], 'alice'), true)
})

test('hasProjectAccess DENIES a non-member, non-admin from another tenant', () => {
  // Project B, owned by carol, with member dave. Mallory belongs to project A only.
  const projectB = { created_by: 'carol' }
  const membersB = [{ user_id: 'carol' }, { user_id: 'dave' }]
  const mallory = { userId: 'mallory', role: 'client' }
  assert.equal(hasProjectAccess(projectB, membersB, mallory), false)
})

test('hasProjectAccess DENIES a non-member advisor (advisors are not global)', () => {
  const project = { created_by: 'carol' }
  const members = [{ user_id: 'carol' }]
  const outsideAdvisor = { userId: 'erin', role: 'advisor' }
  assert.equal(hasProjectAccess(project, members, outsideAdvisor), false)
})

test('hasProjectAccess allows the project creator', () => {
  const project = { created_by: 'carol' }
  assert.equal(hasProjectAccess(project, [], { userId: 'carol', role: 'advisor' }), true)
})

test('hasProjectAccess allows a member', () => {
  const project = { created_by: 'carol' }
  const members = [{ user_id: 'dave' }]
  assert.equal(hasProjectAccess(project, members, { userId: 'dave', role: 'client' }), true)
})

test('hasProjectAccess allows an admin regardless of membership', () => {
  const project = { created_by: 'carol' }
  assert.equal(hasProjectAccess(project, [], { userId: 'frank', role: 'admin' }), true)
})

// ── C2: unknown-email session denial ────────────────────────────────────────
// The bug this replaces: /api/auth/verify auto-created unknown emails as
// `advisor` and issued them a session.

test('canStartSession DENIES an unknown email (no user row)', () => {
  assert.equal(canStartSession(null), false)
  assert.equal(canStartSession(undefined), false)
})

test('canStartSession DENIES a deactivated user', () => {
  assert.equal(canStartSession({ is_active: false }), false)
})

test('canStartSession allows an existing active user', () => {
  assert.equal(canStartSession({ is_active: true }), true)
  assert.equal(canStartSession({}), true) // is_active null/undefined => active
})
