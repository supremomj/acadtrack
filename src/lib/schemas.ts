import { z } from 'zod';
const id = z.uuid(),
  text = z.string().max(10000),
  name = z.string().trim().min(1).max(200),
  date = z.iso.datetime({ offset: true }),
  nullableId = id.nullable();
const base = { id },
  priority = z.enum(['Auto', 'Critical', 'High', 'Medium', 'Low']);
export const preferenceSchema = z
  .object({
    id: z.string(),
    display_name: name,
    timezone: z.string().refine((s) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: s });
        return true;
      } catch {
        return false;
      }
    }, 'Invalid timezone'),
    theme: z.enum(['light', 'dark', 'system']),
    reminder_hours: z.array(z.number().positive().max(8760)).max(20),
    browser_notifications: z.boolean(),
    email_notifications: z.boolean(),
    study_days: z.array(z.number().int().min(0).max(6)),
    study_start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    study_end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    session_minutes: z.number().int().min(5).max(180),
    break_minutes: z.number().int().min(0).max(60),
    target_grade: z.number().min(0).max(100),
    grading_scale: text,
    week_start: z.number().int().min(0).max(1),
    time_format: z.enum(['12h', '24h']),
    date_format: z.enum(['medium', 'short']),
    daily_hours: z.number().min(0.25).max(16),
    default_priority: priority,
  })
  .refine((v) => v.study_end > v.study_start, 'Study end must follow start');
export const schemas = {
  subjects: z
    .object({
      ...base,
      name,
      code: z.string().max(30),
      instructor: text,
      semester: text,
      academic_year: text,
      color: z.string().regex(/^#[0-9a-f]{6}$/i),
      notes: text,
      archived: z.boolean(),
    })
    .strict(),
  tasks: z
    .object({
      ...base,
      subject_id: nullableId,
      title: name,
      description: text,
      category: z.enum([
        'Assignment',
        'Quiz',
        'Exam',
        'Project',
        'Research',
        'Presentation',
        'Other',
      ]),
      assigned_at: date,
      due_at: date,
      target_at: date.nullable(),
      estimated_minutes: z.number().int().min(1).max(100000),
      difficulty: z.number().int().min(1).max(5),
      priority,
      status: z.enum(['Not Started', 'In Progress', 'For Review', 'Completed']),
      progress: z.number().min(0).max(100),
      auto_progress: z.boolean(),
      notes: text,
      completed_at: date.nullable(),
      created_at: date,
    })
    .strict()
    .refine(
      (t) => !t.target_at || t.target_at <= t.due_at,
      'Personal target must be before submission deadline',
    ),
  subtasks: z.object({ ...base, task_id: id, title: name, completed: z.boolean() }).strict(),
  calendar_events: z
    .object({
      ...base,
      subject_id: nullableId,
      title: name,
      starts_at: date,
      ends_at: date,
      kind: z.enum(['Personal', 'Exam', 'Project', 'Class']),
      notes: text,
    })
    .strict()
    .refine((v) => v.ends_at > v.starts_at, 'End must follow start'),
  class_schedules: z
    .object({
      ...base,
      subject_id: id,
      weekday: z.number().int().min(0).max(6),
      start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      location: text,
    })
    .strict()
    .refine((v) => v.end_time > v.start_time, 'End must follow start'),
  study_sessions: z
    .object({
      ...base,
      task_id: nullableId,
      title: name,
      starts_at: date,
      ends_at: date,
      status: z.enum(['Suggested', 'Planned', 'Completed', 'Rejected']),
      actual_minutes: z.number().min(0).max(10000),
      kind: z.enum(['Study', 'Focus']),
    })
    .strict()
    .refine((v) => v.ends_at > v.starts_at, 'End must follow start'),
  grade_categories: z
    .object({ ...base, subject_id: id, name, weight: z.number().positive().max(100) })
    .strict(),
  grades: z
    .object({
      ...base,
      subject_id: id,
      category_id: id,
      title: name,
      score: z.number().min(0),
      maximum: z.number().positive(),
      assessed_at: date,
    })
    .strict()
    .refine((v) => v.score <= v.maximum, 'Score must not exceed maximum'),
  notifications: z
    .object({
      ...base,
      task_id: nullableId,
      title: name,
      body: text,
      created_at: date,
      read: z.boolean(),
    })
    .strict(),
  activity_history: z.object({ ...base, title: name, created_at: date }).strict(),
  task_attachments: z
    .object({
      ...base,
      task_id: id,
      name,
      path: text,
      size: z.number().nonnegative().max(10485760),
      mime_type: text,
    })
    .strict(),
};
