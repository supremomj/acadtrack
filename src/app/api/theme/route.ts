import { NextResponse } from 'next/server';
import { z } from 'zod';
import { serverClient, configured } from '@/lib/supabase/server';
import { workspaceAccess } from '@/lib/access';
export async function POST(req: Request) {
  if (req.headers.get('origin') !== new URL(req.url).origin)
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  if (!configured()) return NextResponse.json({ ok: true });
  const parsed = z
    .object({ theme: z.enum(['light', 'dark', 'system']) })
    .strict()
    .safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid theme' }, { status: 400 });
  const db = await serverClient(),
    {
      data: { user },
    } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
  if (!(await workspaceAccess(db, user)).allowed)
    return NextResponse.json({ error: 'Account access required' }, { status: 403 });
  const { error } = await db
    .from('user_preferences')
    .update({ theme: parsed.data.theme })
    .eq('user_id', user.id);
  return NextResponse.json(
    error ? { error: 'Theme saved on this device; cloud sync is unavailable.' } : { ok: true },
    { status: error ? 500 : 200 },
  );
}
