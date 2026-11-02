import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { serverClient } from '@/lib/supabase/server';
export async function DELETE(req: Request) {
  if (req.headers.get('origin') !== new URL(req.url).origin)
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const db = await serverClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return NextResponse.json(
      { error: 'Account deletion requires the server service-role key' },
      { status: 503 },
    );
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  const { data: files } = await admin
    .from('task_attachments')
    .select('path')
    .eq('user_id', user.id);
  if (files?.length) {
    const { error } = await admin.storage.from('attachments').remove(files.map((f) => f.path));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await db.auth.signOut();
  return NextResponse.json({ ok: true });
}
