import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  effectivePriority,
  isOverdue,
  taskProgress,
  rankTask,
  atRisk,
  overlaps,
  weightedGrade,
  requiredScore,
  suggestSessions,
  zonedDate,
} from '../src/lib/academic';
import { emptyData, type Task } from '../src/lib/types';
import { schemas, preferenceSchema } from '../src/lib/schemas';
const now = new Date('2026-11-02T08:00:00Z');
const task = (hours: number, overrides: Partial<Task> = {}): Task => ({
  id: crypto.randomUUID(),
  subject_id: null,
  title: 'Research paper',
  description: '',
  category: 'Assignment',
  assigned_at: now.toISOString(),
  created_at: now.toISOString(),
  due_at: new Date(+now + hours * 3600000).toISOString(),
  target_at: null,
  estimated_minutes: 120,
  difficulty: 3,
  priority: 'Auto',
  status: 'Not Started',
  progress: 0,
  auto_progress: false,
  notes: '',
  completed_at: null,
  ...overrides,
});
test('deadline priority boundaries and manual overrides', () => {
  for (const [h, expected] of [
    [24, 'Critical'],
    [24.01, 'High'],
    [72, 'High'],
    [72.01, 'Medium'],
    [168, 'Medium'],
    [169, 'Low'],
  ] as const)
    assert.equal(effectivePriority(task(h), now), expected);
  assert.equal(effectivePriority(task(1, { priority: 'Low' }), now), 'Low');
});
test('completed tasks are never overdue', () => {
  assert.equal(isOverdue(task(-1), now), true);
  assert.equal(isOverdue(task(-1, { status: 'Completed' }), now), false);
});
test('subtasks drive progress only when enabled', () => {
  const d = emptyData(),
    t = task(24, { auto_progress: true });
  d.subtasks = [
    { id: crypto.randomUUID(), task_id: t.id, title: 'First', completed: true },
    { id: crypto.randomUUID(), task_id: t.id, title: 'Second', completed: false },
  ];
  assert.equal(taskProgress(t, d), 50);
  assert.equal(taskProgress({ ...t, auto_progress: false, progress: 20 }, d), 20);
  assert.equal(taskProgress({ ...t, status: 'Completed' }, d), 100);
});
test('ranking includes work remaining, difficulty and capacity', () => {
  const d = emptyData(),
    easy = task(48, { estimated_minutes: 20, difficulty: 1 }),
    hard = task(48, { estimated_minutes: 500, difficulty: 5 });
  assert.ok(rankTask(hard, d, now) > rankTask(easy, d, now));
  assert.ok(atRisk(task(1, { estimated_minutes: 500 }), d, now));
  assert.equal(rankTask(task(1, { status: 'Completed' }), d, now), -Infinity);
});
test('adjacent events do not conflict, intersecting events do', () => {
  const a = { starts_at: '2026-11-02T09:00Z', ends_at: '2026-11-02T10:00Z' };
  assert.equal(
    overlaps(a, { starts_at: '2026-11-02T10:00Z', ends_at: '2026-11-02T11:00Z' }),
    false,
  );
  assert.equal(overlaps(a, { starts_at: '2026-11-02T09:30Z', ends_at: '2026-11-02T11:00Z' }), true);
});
test('weighted grades pool category points and normalize assessed weight', () => {
  const cats = [
      { id: 'a', subject_id: 's', name: 'Quiz', weight: 40 },
      { id: 'b', subject_id: 's', name: 'Exam', weight: 60 },
    ],
    g = [
      {
        id: 'g',
        subject_id: 's',
        category_id: 'a',
        title: 'Quiz 1',
        score: 80,
        maximum: 100,
        assessed_at: now.toISOString(),
      },
    ];
  const r = weightedGrade(cats, g);
  assert.equal(r.current, 80);
  assert.equal(r.earned, 32);
  assert.equal(r.remainingWeight, 60);
  assert.ok(Math.abs(requiredScore(90, r.earned, r.remainingWeight)! - 96.6667) < 0.001);
  assert.equal(requiredScore(90, 90, 0), null);
  assert.equal(weightedGrade(cats, []).current, null);
});
test('timezone conversion observes DST and Manila offsets', () => {
  assert.equal(
    zonedDate('2026-11-02', '17:00', 'Asia/Manila').toISOString(),
    '2026-11-02T09:00:00.000Z',
  );
  assert.equal(
    zonedDate('2026-07-02', '17:00', 'America/New_York').toISOString(),
    '2026-07-02T21:00:00.000Z',
  );
  assert.equal(
    zonedDate('2026-12-02', '17:00', 'America/New_York').toISOString(),
    '2026-12-02T22:00:00.000Z',
  );
});
test('planner respects class, events, sessions, daily limits and deadlines', () => {
  const d = emptyData();
  d.tasks = [task(72, { estimated_minutes: 500 })];
  d.preferences = {
    ...d.preferences,
    study_days: [1, 2, 3, 4, 5],
    study_start: '17:00',
    study_end: '21:00',
    session_minutes: 25,
    break_minutes: 5,
    daily_hours: 1,
  };
  d.class_schedules = [
    { id: 'c', subject_id: 's', weekday: 1, start_time: '17:00', end_time: '18:00', location: '' },
  ];
  d.calendar_events = [
    {
      id: 'e',
      subject_id: null,
      title: 'Appointment',
      starts_at: '2026-11-02T10:00:00Z',
      ends_at: '2026-11-02T11:00:00Z',
      kind: 'Personal',
      notes: '',
    },
  ];
  const result = suggestSessions(d, now);
  assert.ok(result.length > 0);
  for (let i = 0; i < result.length; i++) {
    const s = result[i];
    assert.ok(+new Date(s.ends_at) <= +new Date(d.tasks[0].due_at));
    assert.ok(!d.calendar_events.some((e) => overlaps(e, s)));
    assert.ok(!result.some((other, j) => i !== j && overlaps(s, other)));
    if (s.starts_at.startsWith('2026-11-02'))
      assert.ok(+new Date(s.starts_at) >= +new Date('2026-11-02T11:00:00Z'));
  }
  const byDay = new Map<string, number>();
  for (const s of result) {
    const k = s.starts_at.slice(0, 10);
    byDay.set(k, (byDay.get(k) || 0) + (+new Date(s.ends_at) - +new Date(s.starts_at)) / 60000);
  }
  assert.ok([...byDay.values()].every((n) => n <= 60));
});
test('planner accounts for already planned work and completed tasks', () => {
  const d = emptyData(),
    t = task(72, { estimated_minutes: 25 });
  d.tasks = [t, task(72, { status: 'Completed' })];
  d.study_sessions = [
    {
      id: 's',
      task_id: t.id,
      title: 'Planned',
      starts_at: '2026-11-02T09:00:00Z',
      ends_at: '2026-11-02T09:25:00Z',
      status: 'Planned',
      actual_minutes: 0,
      kind: 'Study',
    },
  ];
  assert.equal(suggestSessions(d, now).length, 0);
});
test('validation rejects invalid scores, timezones, targets and extra ownership fields', () => {
  assert.equal(
    schemas.tasks.safeParse(task(24, { target_at: new Date(+now + 48 * 3600000).toISOString() }))
      .success,
    false,
  );
  assert.equal(
    schemas.tasks.safeParse({ ...task(24), user_id: crypto.randomUUID() }).success,
    false,
  );
  assert.equal(
    preferenceSchema.safeParse({ ...emptyData().preferences, timezone: 'Imaginary/Moon' }).success,
    false,
  );
  assert.equal(
    schemas.grades.safeParse({
      id: crypto.randomUUID(),
      subject_id: crypto.randomUUID(),
      category_id: crypto.randomUUID(),
      title: 'Quiz',
      score: 120,
      maximum: 100,
      assessed_at: now.toISOString(),
    }).success,
    false,
  );
});
