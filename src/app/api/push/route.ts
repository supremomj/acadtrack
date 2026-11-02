import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { workspaceAccess, accessMessage } from '@/lib/access';
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
  const parsed = z
    .object({
      endpoint: z.url().refine((s) => {
        const u = new URL(s);
        return (
          u.protocol === 'https:' &&
          (u.hostname === 'fcm.googleapis.com' ||
            u.hostname.endsWith('.push.services.mozilla.com') ||
            u.hostname === 'web.push.apple.com' ||
            u.hostname.endsWith('.notify.windows.com'))
        );
      }),
      keys: z.object({ p256dh: z.string().min(20).max(300), auth: z.string().min(10).max(200) }),
    })
    .safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: 'Unsupported push subscription' }, { status: 400 });
  const { error } = await db
    .from('push_subscriptions')
    .upsert(
      { user_id: user.id, endpoint: parsed.data.endpoint, subscription: parsed.data },
      { onConflict: 'user_id,endpoint' },
    );
  return NextResponse.json(error ? { error: error.message } : { ok: true }, {
    status: error ? 400 : 200,
  });
}
