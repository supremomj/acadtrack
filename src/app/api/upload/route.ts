import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
import { workspaceAccess, accessMessage } from '@/lib/access';
const allowed = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
export async function POST(req: Request) {
  if (req.headers.get('origin') !== new URL(req.url).origin)
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const db = await serverClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await workspaceAccess(db, user);
  if (!access.allowed) return NextResponse.json({ error: accessMessage(access) }, { status: 403 });
  const f = await req.formData(),
    file = f.get('file'),
    task = f.get('task_id');
  if (!(file instanceof File) || file.size > 10485760 || !allowed.includes(file.type))
    return NextResponse.json(
      { error: 'Use a PDF, PNG, JPEG, TXT, DOCX or XLSX up to 10 MB' },
      { status: 400 },
    );
  const { data: owner } = await db
    .from('tasks')
    .select('id')
    .eq('id', task)
    .eq('user_id', user.id)
    .single();
  if (!owner) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  const path = `${user.id}/${crypto.randomUUID()}/${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error } = await db.storage
    .from('attachments')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const record = {
    id: crypto.randomUUID(),
    user_id: user.id,
    task_id: task,
    name: file.name,
    path,
    size: file.size,
    mime_type: file.type,
  };
  const { error: insertError } = await db.from('task_attachments').insert(record);
  if (insertError) {
    await db.storage.from('attachments').remove([path]);
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }
  return NextResponse.json(record);
}
export async function GET(req: Request) {
  const db = await serverClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  const access = await workspaceAccess(db, user);
  if (!access.allowed) return NextResponse.json({ error: accessMessage(access) }, { status: 403 });
  const { data } = await db
    .from('task_attachments')
    .select('path')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { data: link } = await db.storage.from('attachments').createSignedUrl(data.path, 60);
  return NextResponse.json({ url: link?.signedUrl });
}
