import { NextResponse } from 'next/server';
import { serverClient, configured } from '@/lib/supabase/server';
import { tables, defaultPreferences } from '@/lib/types';
import { workspaceAccess, accessMessage } from '@/lib/access';
export async function GET() {
  if (!configured()) return NextResponse.json({ mode: 'local' });
  const db = await serverClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
  const access = await workspaceAccess(db, user);
  if (!access.allowed) return NextResponse.json({ error: accessMessage(access) }, { status: 403 });
  const collections = [...tables, 'academic_snapshots', 'weekly_reviews'];
  const results = await Promise.all(
    collections.map(async (t) => {
      let rows: Record<string, unknown>[] = [];
      for (let page = 0; ; page++) {
        const r = await db
          .from(t)
          .select('*')
          .eq('user_id', user.id)
          .order('id')
          .range(page * 500, page * 500 + 499);
        if (r.error) return { data: null, error: r.error };
        rows = rows.concat(r.data);
        if (r.data.length < 500) return { data: rows, error: null };
      }
    }),
  );
  const error = results.find((r) => r.error)?.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: pref, error: prefError } = await db
    .from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (prefError) return NextResponse.json({ error: prefError.message }, { status: 500 });
  const strip = (r: Record<string, unknown>) => {
    const { user_id, ...rest } = r;
    void user_id;
    return rest;
  };
  return NextResponse.json(
    // Announcements are public only to active, verified workspace members.
    {
      mode: 'cloud',
      user: { id: user.id, email: user.email, is_admin: access.is_admin },
      data: {
        ...Object.fromEntries(collections.map((t, i) => [t, results[i].data?.map(strip) || []])),
        preferences: { ...defaultPreferences, ...(pref ? strip(pref) : {}), id: user.id },
        announcements: access.migration_required
          ? []
          : (
              await db
                .from('announcements')
                .select('id,title,body,updated_at')
                .eq('published', true)
                .order('updated_at', { ascending: false })
                .limit(10)
            ).data || [],
      },
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
