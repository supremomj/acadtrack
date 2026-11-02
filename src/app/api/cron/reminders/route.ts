import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(req: Request) {
  if (
    !process.env.CRON_SECRET ||
    req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`
  )
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    return NextResponse.json({ error: 'Configure Supabase server credentials' }, { status: 503 });
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  const { error: summaryError } = await db.rpc('capture_academic_summaries');
  if (summaryError) return NextResponse.json({ error: summaryError.message }, { status: 500 });
  const { data: generated, error: enqueueError } = await db.rpc('enqueue_reminders');
  if (enqueueError) return NextResponse.json({ error: enqueueError.message }, { status: 500 });
  const { data: jobs, error } = await db.rpc('claim_reminders');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const pushReady = !!(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT
  );
  if (pushReady)
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
  let sent = 0,
    failed = 0;
  for (let i = 0; i < (jobs || []).length; i += 10) {
    await Promise.all(
      jobs.slice(i, i + 10).map(
        async (job: {
          id: string;
          user_id: string;
          channel: string;
          destination: string;
          payload: {
            subscription: webpush.PushSubscription;
            title: string;
            body: string;
            id: string;
          };
          attempts: number;
        }) => {
          try {
            if (job.channel === 'push') {
              if (!pushReady) throw new Error('VAPID keys not configured');
              await webpush.sendNotification(
                job.payload.subscription,
                JSON.stringify({
                  title: job.payload.title,
                  body: job.payload.body,
                  id: job.payload.id,
                }),
                { TTL: 3600, timeout: 8000 },
              );
            } else {
              if (!process.env.RESEND_API_KEY || !process.env.REMINDER_FROM)
                throw new Error('Email provider not configured');
              const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                  'Content-Type': 'application/json',
                  'Idempotency-Key': job.id,
                },
                body: JSON.stringify({
                  from: process.env.REMINDER_FROM,
                  to: [job.destination],
                  subject: job.payload.title,
                  text: `${job.payload.body}\n\n${process.env.NEXT_PUBLIC_APP_URL || ''}`,
                }),
                signal: AbortSignal.timeout(8000),
              });
              if (!res.ok) throw new Error(`Email provider returned ${res.status}`);
            }
            await db
              .from('reminder_deliveries')
              .update({ status: 'sent', last_error: null })
              .eq('id', job.id);
            sent++;
          } catch (e) {
            const statusCode = (e as { statusCode?: number }).statusCode;
            if (job.channel === 'push' && (statusCode === 410 || statusCode === 404))
              await db
                .from('push_subscriptions')
                .delete()
                .eq('user_id', job.user_id)
                .eq('endpoint', job.destination);
            await db
              .from('reminder_deliveries')
              .update({
                status: job.attempts >= 5 || statusCode === 410 ? 'failed' : 'pending',
                available_at: new Date(
                  Date.now() + Math.pow(2, job.attempts) * 60000,
                ).toISOString(),
                last_error: (e as Error).message.slice(0, 300),
              })
              .eq('id', job.id);
            failed++;
          }
        },
      ),
    );
  }
  return NextResponse.json({ generated, sent, failed });
}
