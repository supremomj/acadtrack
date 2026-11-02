import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { workspaceAccess } from '../src/lib/access';
const user = {
  id: 'test',
  email_confirmed_at: '2026-11-02T00:00:00Z',
  user_metadata: { is_admin: true },
} as unknown as User;
const client = (result: unknown) => ({ rpc: async () => result }) as unknown as SupabaseClient;
test('missing admin migration never trusts user-editable metadata for roles', async () => {
  const access = await workspaceAccess(client({ error: { code: 'PGRST202' } }), user);
  assert.equal(access.is_admin, false);
  assert.equal(access.allowed, true);
  assert.equal(access.migration_required, true);
});
test('unverified accounts remain blocked before admin migration', async () => {
  const access = await workspaceAccess(client({ error: { code: 'PGRST202' } }), {
    ...user,
    email_confirmed_at: undefined,
  });
  assert.equal(access.allowed, false);
});
test('unexpected access-check errors fail closed', async () => {
  await assert.rejects(
    workspaceAccess(client({ error: { code: 'XX000' } }), user),
    /Could not verify account access/,
  );
});
