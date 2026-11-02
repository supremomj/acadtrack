import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
test('PostgreSQL migration, security policies, constraints and reminder automation', async (t) => {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create schema auth;create table auth.users(id uuid primary key,email text);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
   create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid,name text,bucket_id text);alter table storage.objects enable row level security;
   create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`);
    await db.exec(await readFile('supabase/migrations/001_acadtrack.sql', 'utf8'));
    await db.exec(await readFile('supabase/migrations/002_reviews_and_metrics.sql', 'utf8'));
    await db.exec(
      `grant usage on schema public to authenticated,service_role;grant all on all tables in schema public to authenticated,service_role;grant execute on all functions in schema public to service_role;`,
    );
    const a = crypto.randomUUID(),
      b = crypto.randomUUID(),
      sa = crypto.randomUUID(),
      sb = crypto.randomUUID(),
      ta = crypto.randomUUID();
    await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)', [
      a,
      'a@example.test',
      b,
      'b@example.test',
    ]);
    async function asUser(id: string) {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
      await db.exec('set role authenticated');
    }
    await t.test('new users receive preferences with Manila timezone', async () => {
      const r = await db.query<{ timezone: string }>(
        'select timezone from user_preferences where user_id=$1',
        [a],
      );
      assert.equal(r.rows[0].timezone, 'Asia/Manila');
    });
    await asUser(a);
    await db.query("insert into subjects(id,user_id,name) values($1,$2,'Subject A')", [sa, a]);
    await asUser(b);
    await db.query("insert into subjects(id,user_id,name) values($1,$2,'Subject B')", [sb, b]);
    await t.test('RLS hides other users and prevents forged ownership', async () => {
      const r = await db.query<{ id: string }>('select id from subjects');
      assert.deepEqual(
        r.rows.map((r) => r.id),
        [sb],
      );
      await assert.rejects(
        db.query("insert into subjects(id,user_id,name) values($1,$2,'Forged')", [
          crypto.randomUUID(),
          a,
        ]),
        /row-level security/i,
      );
    });
    await t.test('foreign keys prevent cross-user subject references', async () => {
      await assert.rejects(
        db.query(
          "insert into tasks(user_id,subject_id,title,due_at) values($1,$2,'Foreign task',now()+interval '1 day')",
          [b, sa],
        ),
        /foreign key/i,
      );
    });
    await asUser(a);
    await db.query(
      "insert into tasks(id,user_id,subject_id,title,due_at,created_at,auto_progress) values($1,$2,$3,'Paper',now()+interval '50 minutes',now()-interval '8 days',true)",
      [ta, a, sa],
    );
    await t.test('subtask triggers update task progress', async () => {
      await db.query(
        "insert into subtasks(user_id,task_id,title,completed) values($1,$2,'One',true),($1,$2,'Two',false)",
        [a, ta],
      );
      const r = await db.query<{ progress: string }>('select progress from tasks where id=$1', [
        ta,
      ]);
      assert.equal(Number(r.rows[0].progress), 50);
    });
    await t.test('grade category totals cannot exceed 100 percent', async () => {
      await db.query(
        "insert into grade_categories(user_id,subject_id,name,weight) values($1,$2,'Exams',70)",
        [a, sa],
      );
      await assert.rejects(
        db.query(
          "insert into grade_categories(user_id,subject_id,name,weight) values($1,$2,'Projects',40)",
          [a, sa],
        ),
        /exceed 100/i,
      );
    });
    await t.test('database rejects overlapping study sessions and class conflicts', async () => {
      await db.query(
        "insert into study_sessions(user_id,title,starts_at,ends_at) values($1,'First','2026-11-03T09:00Z','2026-11-03T10:00Z')",
        [a],
      );
      await assert.rejects(
        db.query(
          "insert into study_sessions(user_id,title,starts_at,ends_at) values($1,'Overlap','2026-11-03T09:30Z','2026-11-03T10:30Z')",
          [a],
        ),
        /exclusion constraint/i,
      );
      await db.query(
        "insert into class_schedules(user_id,subject_id,weekday,start_time,end_time) values($1,$2,2,'19:00','20:00')",
        [a, sa],
      );
      await assert.rejects(
        db.query(
          "insert into study_sessions(user_id,title,starts_at,ends_at) values($1,'Class overlap','2026-11-03T11:00Z','2026-11-03T11:30Z')",
          [a],
        ),
        /overlaps a class/i,
      );
    });
    await t.test('cron functions cannot be called by authenticated students', async () => {
      await assert.rejects(db.query('select enqueue_reminders()'), /permission denied/i);
    });
    await db.exec('reset role');
    await db.exec('set role service_role');
    await t.test('weekly summaries and daily snapshots are idempotent', async () => {
      await db.query('select capture_academic_summaries()');
      await db.query('select capture_academic_summaries()');
      const reviews = await db.query<{ count: number }>(
          'select count(*)::int from weekly_reviews where user_id=$1',
          [a],
        ),
        snapshots = await db.query<{ count: number }>(
          'select count(*)::int from academic_snapshots where user_id=$1',
          [a],
        );
      assert.equal(reviews.rows[0].count, 1);
      assert.equal(snapshots.rows[0].count, 1);
    });
    await t.test('repeated cron runs generate each interval exactly once', async () => {
      const first = await db.query<{ enqueue_reminders: number }>('select enqueue_reminders()');
      assert.equal(first.rows[0].enqueue_reminders, 5);
      const second = await db.query<{ enqueue_reminders: number }>('select enqueue_reminders()');
      assert.equal(second.rows[0].enqueue_reminders, 0);
      const r = await db.query<{ count: number }>(
        'select count(*)::int from notifications where task_id=$1',
        [ta],
      );
      assert.equal(r.rows[0].count, 5);
    });
    await db.exec('reset role');
    await asUser(a);
    await t.test('completion stamps history and keeps past deadlines completed', async () => {
      await db.query(
        "update tasks set status='Completed',due_at=now()-interval '1 day' where id=$1",
        [ta],
      );
      const r = await db.query<{
        effective_status: string;
        progress: string;
        completed_at: unknown;
      }>('select effective_status,progress,completed_at from task_status where id=$1', [ta]);
      assert.equal(r.rows[0].effective_status, 'Completed');
      assert.equal(Number(r.rows[0].progress), 100);
      assert.ok(r.rows[0].completed_at);
      const history = await db.query('select * from activity_history where user_id=$1', [a]);
      assert.ok(history.rows.length >= 3);
    });
    await db.exec('reset role');
    await t.test(
      'account deletion cascades user data without breaking history triggers',
      async () => {
        await db.query('delete from auth.users where id=$1', [a]);
        const r = await db.query<{ count: number }>(
          'select count(*)::int from tasks where user_id=$1',
          [a],
        );
        assert.equal(r.rows[0].count, 0);
      },
    );
  } finally {
    await db.close();
  }
});
