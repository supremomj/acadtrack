import { NextResponse } from 'next/server';
import { serverClient, configured } from '@/lib/supabase/server';
import { workspaceAccess } from '@/lib/access';
import { z } from 'zod';
const actionSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('suspend'),
      user_id: z.uuid(),
      suspended: z.boolean(),
      reason: z.string().max(500),
    })
    .strict(),
  z
    .object({
      action: z.literal('announcement'),
      id: z.uuid().nullable(),
      title: z.string().trim().min(1).max(150),
      body: z.string().trim().min(1).max(4000),
      published: z.boolean(),
    })
    .strict(),
  z.object({ action: z.literal('delete_announcement'), id: z.uuid() }).strict(),
]);
export async function GET(req: Request) {
  try {
    if (!configured())
      return NextResponse.json({ error: 'Admin tools require a cloud workspace' }, { status: 503 });
    const db = await serverClient(),
      {
        data: { user },
      } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
    const access = await workspaceAccess(db, user);
    if (!access.is_admin)
      return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
    const query = new URL(req.url).searchParams,
      search = z
        .string()
        .max(200)
        .parse(query.get('search') || ''),
      page = z.coerce
        .number()
        .int()
        .min(0)
        .max(100000)
        .parse(query.get('page') || 0);
    const { data, error } = await db.rpc('admin_overview', { p_search: search, p_page: page });
    if (error) throw error;
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json(
      { error: 'Could not load administration. Check that migration 003 is installed.' },
      { status: 500 },
    );
  }
}
export async function POST(req: Request) {
  try {
    if (req.headers.get('origin') !== new URL(req.url).origin)
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    if (!configured())
      return NextResponse.json({ error: 'Admin tools require a cloud workspace' }, { status: 503 });
    const db = await serverClient(),
      {
        data: { user },
      } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
    if (!(await workspaceAccess(db, user)).is_admin)
      return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
    const body = actionSchema.parse(await req.json());
    const { error } =
      body.action === 'suspend'
        ? await db.rpc('admin_set_suspension', {
            p_user_id: body.user_id,
            p_suspended: body.suspended,
            p_reason: body.reason,
          })
        : body.action === 'announcement'
          ? await db.rpc('admin_save_announcement', {
              p_id: body.id,
              p_title: body.title,
              p_body: body.body,
              p_published: body.published,
            })
          : await db.rpc('admin_delete_announcement', { p_id: body.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof z.ZodError
            ? 'Please check the entered values.'
            : 'Could not save the administration change.',
      },
      { status: 400 },
    );
  }
}
