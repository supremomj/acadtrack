import { redirect } from 'next/navigation';
import { serverClient, configured } from '@/lib/supabase/server';
import { workspaceAccess } from '@/lib/access';
import { AdminDashboard } from '@/components/admin-dashboard';
import type { ThemeMode } from '@/components/theme-provider';
export const dynamic = 'force-dynamic';
export default async function AdminPage() {
  if (!configured()) redirect('/login');
  const db = await serverClient(),
    {
      data: { user },
    } = await db.auth.getUser();
  if (!user) redirect('/login');
  const access = await workspaceAccess(db, user);
  if (!access.is_admin) redirect('/');
  const { data: preferences } = await db
    .from('user_preferences')
    .select('theme')
    .eq('user_id', user.id)
    .maybeSingle();
  return (
    <AdminDashboard
      email={user.email || ''}
      initialTheme={(preferences?.theme || 'system') as ThemeMode}
    />
  );
}
