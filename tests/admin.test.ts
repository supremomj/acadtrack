import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

test('administration enforces verified roles, suspension, privacy and audit records', async (t) => {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),last_sign_in_at timestamptz,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid,name text,bucket_id text);alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`);
    for (const file of ['001_acadtrack.sql', '002_reviews_and_metrics.sql'])
      await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
    await db.exec(
      'grant usage on schema public to authenticated,service_role;grant all on all tables in schema public to authenticated,service_role;',
    );
    await db.exec(await readFile('supabase/migrations/003_admin.sql', 'utf8'));
    const admin = crypto.randomUUID(),
      student = crypto.randomUUID(),
      unverified = crypto.randomUUID(),
      subject = crypto.randomUUID(),
      task = crypto.randomUUID();
    await db.query(
      'insert into auth.users(id,email,email_confirmed_at) values($1,$2,now()),($3,$4,now()),($5,$6,null)',
      [
        admin,
        'admin@example.test',
        student,
        'student@example.test',
        unverified,
        'unverified@example.test',
      ],
    );
    await db.query('insert into admin_memberships(user_id) values($1)', [admin]);
    await db.query("insert into subjects(id,user_id,name) values($1,$2,'PRIVATE SUBJECT')", [
      subject,
      student,
    ]);
    await db.query(
      "insert into tasks(id,user_id,subject_id,title,notes,due_at) values($1,$2,$3,'PRIVATE TASK','PRIVATE NOTES',now()+interval '1 day')",
      [task, student, subject],
    );
    async function asUser(id: string) {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
      await db.exec('set role authenticated');
    }
    await asUser(student);
    await t.test('students cannot self-promote or write suspension records', async () => {
      await assert.rejects(
        db.query('insert into admin_memberships(user_id) values($1)', [student]),
        /permission denied|row-level security/i,
      );
      await assert.rejects(
        db.query('insert into account_access(user_id,suspended) values($1,true)', [admin]),
        /permission denied|row-level security/i,
      );
    });
    await t.test('students cannot invoke admin actions or read user directory', async () => {
      await assert.rejects(db.query('select admin_overview()'), /administrator access required/i);
      await assert.rejects(
        db.query("select admin_set_suspension($1,true,'Not allowed')", [admin]),
        /administrator access required/i,
      );
      await assert.rejects(
        db.query("select admin_save_announcement(null,'Fake','Fake message',true)"),
        /administrator access required/i,
      );
    });
    await asUser(unverified);
    await t.test(
      'unverified accounts cannot access academic records even with a session',
      async () => {
        const r = await db.query<{ workspace_access: { allowed: boolean; verified: boolean } }>(
          'select workspace_access()',
        );
        assert.equal(r.rows[0].workspace_access.allowed, false);
        assert.equal(r.rows[0].workspace_access.verified, false);
        await assert.rejects(
          db.query("insert into subjects(user_id,name) values($1,'Unverified subject')", [
            unverified,
          ]),
          /row-level security/i,
        );
      },
    );
    await asUser(admin);
    await t.test(
      'admins receive account metadata and aggregate counts, not private coursework',
      async () => {
        const r = await db.query<{
          admin_overview: {
            accounts: { email: string }[];
            stats: { users: number; tasks: number };
          };
        }>('select admin_overview()');
        assert.equal(r.rows[0].admin_overview.stats.users, 3);
        assert.equal(r.rows[0].admin_overview.stats.tasks, 1);
        assert.equal(r.rows[0].admin_overview.accounts.length, 3);
        assert.ok(!JSON.stringify(r.rows).includes('PRIVATE'));
        const privateRows = await db.query('select * from tasks where id=$1', [task]);
        assert.equal(privateRows.rows.length, 0);
      },
    );
    await t.test('administrator accounts cannot suspend themselves', async () => {
      await assert.rejects(
        db.query("select admin_set_suspension($1,true,'Self suspension')", [admin]),
        /cannot be suspended/i,
      );
    });
    let published = '';
    await t.test(
      'announcements support drafts and publication with atomic audit logging',
      async () => {
        await db.query("select admin_save_announcement(null,'Draft','Hidden message',false)");
        const r = await db.query<{ admin_save_announcement: string }>(
          "select admin_save_announcement(null,'Welcome','Visible to active accounts',true)",
        );
        published = r.rows[0].admin_save_announcement;
      },
    );
    await asUser(student);
    await t.test('students see only published announcements', async () => {
      const r = await db.query<{ title: string }>('select title from announcements');
      assert.deepEqual(
        r.rows.map((x) => x.title),
        ['Welcome'],
      );
    });
    await asUser(admin);
    await db.query("select admin_set_suspension($1,true,'Account under review')", [student]);
    await asUser(student);
    await t.test(
      'suspension takes effect for existing sessions and direct database calls',
      async () => {
        const r = await db.query<{ workspace_access: { allowed: boolean; suspended: boolean } }>(
          'select workspace_access()',
        );
        assert.equal(r.rows[0].workspace_access.suspended, true);
        assert.equal(r.rows[0].workspace_access.allowed, false);
        assert.equal((await db.query('select id from tasks')).rows.length, 0);
        assert.equal((await db.query('select id from announcements')).rows.length, 0);
        await assert.rejects(
          db.query("insert into subjects(user_id,name) values($1,'Blocked write')", [student]),
          /row-level security/i,
        );
      },
    );
    await asUser(admin);
    await db.query("select admin_set_suspension($1,false,'Review completed')", [student]);
    await asUser(student);
    await t.test('restoring access preserves private academic records', async () => {
      assert.equal((await db.query('select id from tasks where id=$1', [task])).rows.length, 1);
    });
    await asUser(admin);
    await t.test('search, announcement removal and audit history work', async () => {
      const search = await db.query<{ admin_overview: { total: number } }>(
        "select admin_overview('student@',0)",
      );
      assert.equal(search.rows[0].admin_overview.total, 1);
      await db.query('select admin_delete_announcement($1)', [published]);
      const r = await db.query<{
        admin_overview: { audit: { action: string }[]; announcements: { published: boolean }[] };
      }>('select admin_overview()');
      assert.ok(r.rows[0].admin_overview.audit.some((a) => a.action === 'Account suspended'));
      assert.ok(r.rows[0].admin_overview.audit.some((a) => a.action === 'Account restored'));
      assert.ok(r.rows[0].admin_overview.audit.some((a) => a.action === 'Announcement deleted'));
      assert.equal(r.rows[0].admin_overview.announcements.length, 1);
    });
    await db.exec('reset role');
    await db.exec('set role anon');
    await t.test('anonymous callers cannot invoke administration or access checks', async () => {
      await assert.rejects(db.query('select admin_overview()'), /permission denied/i);
      await assert.rejects(db.query('select workspace_access()'), /permission denied/i);
    });
  } finally {
    await db.close();
  }
});
