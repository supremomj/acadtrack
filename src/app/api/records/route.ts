import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
import { schemas, preferenceSchema } from '@/lib/schemas';
import { z } from 'zod';
import { workspaceAccess, accessMessage } from '@/lib/access';
export async function POST(req: Request) {
  try {
    if (req.headers.get('origin') !== new URL(req.url).origin)
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    const db = await serverClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
    const access = await workspaceAccess(db, user);
    if (!access.allowed)
      return NextResponse.json({ error: accessMessage(access) }, { status: 403 });
    const { table, action, record, id } = await req.json();
    if (table === 'preferences') {
      const p = preferenceSchema.parse(record);
      const { error } = await db
        .from('user_preferences')
        .upsert({ ...p, id: user.id, user_id: user.id });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (!(table in schemas))
      return NextResponse.json({ error: 'Unknown collection' }, { status: 400 });
    if (action === 'delete') {
      z.uuid().parse(id);
      const { error } = await db.from(table).delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
    } else if (action === 'save') {
      const parsed = schemas[table as keyof typeof schemas].parse(record);
      if (table === 'study_sessions' && 'status' in parsed && parsed.status === 'Planned') {
        const { data: conflict } = await db
          .from('study_sessions')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'Planned')
          .neq('id', parsed.id)
          .lt('starts_at', record.ends_at)
          .gt('ends_at', record.starts_at);
        const { data: events } = await db
          .from('calendar_events')
          .select('id')
          .eq('user_id', user.id)
          .lt('starts_at', record.ends_at)
          .gt('ends_at', record.starts_at);
        if (conflict?.length || events?.length)
          return NextResponse.json(
            { error: 'This session overlaps an existing activity' },
            { status: 409 },
          );
      }
      const { error } = await db.from(table).upsert({ ...parsed, user_id: user.id });
      if (error) throw error;
    } else return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : (e as { message?: string }).message || 'Could not save record',
      },
      { status: 400 },
    );
  }
}
