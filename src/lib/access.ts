import type { SupabaseClient, User } from '@supabase/supabase-js';
export type WorkspaceAccess = {
  allowed: boolean;
  is_admin: boolean;
  verified: boolean;
  suspended: boolean;
  migration_required?: boolean;
};
export async function workspaceAccess(db: SupabaseClient, user: User): Promise<WorkspaceAccess> {
  const { data, error } = await db.rpc('workspace_access');
  if (error) {
    // Existing installations can continue as students until migration 003 is applied.
    // Admin access always fails closed; no suspension records exist before migration.
    if (error.code === 'PGRST202' || error.code === '42883')
      return {
        allowed: !!user.email_confirmed_at,
        is_admin: false,
        verified: !!user.email_confirmed_at,
        suspended: false,
        migration_required: true,
      };
    throw new Error('Could not verify account access. Please try again.');
  }
  return data as WorkspaceAccess;
}
export function accessMessage(access: WorkspaceAccess) {
  return access.suspended
    ? 'Your account is suspended. Contact the site administrator.'
    : 'Confirm your email before signing in. Check your inbox for the verification link.';
}
