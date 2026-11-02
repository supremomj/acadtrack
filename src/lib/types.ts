export const statuses = ['Not Started', 'In Progress', 'For Review', 'Completed'] as const;
export const categories = [
  'Assignment',
  'Quiz',
  'Exam',
  'Project',
  'Research',
  'Presentation',
  'Other',
] as const;
export type Priority = 'Auto' | 'Critical' | 'High' | 'Medium' | 'Low';
export type Subject = {
  id: string;
  name: string;
  code: string;
  instructor: string;
  semester: string;
  academic_year: string;
  color: string;
  notes: string;
  archived: boolean;
};
export type Task = {
  id: string;
  subject_id: string | null;
  title: string;
  description: string;
  category: (typeof categories)[number];
  assigned_at: string;
  due_at: string;
  target_at: string | null;
  estimated_minutes: number;
  difficulty: number;
  priority: Priority;
  status: (typeof statuses)[number];
  progress: number;
  auto_progress: boolean;
  notes: string;
  completed_at: string | null;
  created_at: string;
};
export type Subtask = { id: string; task_id: string; title: string; completed: boolean };
export type CalendarEvent = {
  id: string;
  subject_id: string | null;
  title: string;
  starts_at: string;
  ends_at: string;
  kind: 'Personal' | 'Exam' | 'Project' | 'Class';
  notes: string;
};
export type ClassSchedule = {
  id: string;
  subject_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  location: string;
};
export type StudySession = {
  id: string;
  task_id: string | null;
  title: string;
  starts_at: string;
  ends_at: string;
  status: 'Suggested' | 'Planned' | 'Completed' | 'Rejected';
  actual_minutes: number;
  kind: 'Study' | 'Focus';
};
export type GradeCategory = { id: string; subject_id: string; name: string; weight: number };
export type Grade = {
  id: string;
  subject_id: string;
  category_id: string;
  title: string;
  score: number;
  maximum: number;
  assessed_at: string;
};
export type Notice = {
  id: string;
  task_id: string | null;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
};
export type Activity = { id: string; title: string; created_at: string };
export type Attachment = {
  id: string;
  task_id: string;
  name: string;
  path: string;
  size: number;
  mime_type: string;
};
export type Preferences = {
  id: string;
  display_name: string;
  timezone: string;
  theme: 'light' | 'dark' | 'system';
  reminder_hours: number[];
  browser_notifications: boolean;
  email_notifications: boolean;
  study_days: number[];
  study_start: string;
  study_end: string;
  session_minutes: number;
  break_minutes: number;
  target_grade: number;
  grading_scale: string;
  week_start: number;
  time_format: '12h' | '24h';
  date_format: 'medium' | 'short';
  daily_hours: number;
  default_priority: Priority;
};
export type EntityMap = {
  subjects: Subject;
  tasks: Task;
  subtasks: Subtask;
  calendar_events: CalendarEvent;
  class_schedules: ClassSchedule;
  study_sessions: StudySession;
  grade_categories: GradeCategory;
  grades: Grade;
  notifications: Notice;
  activity_history: Activity;
  task_attachments: Attachment;
};
export type Table = keyof EntityMap;
export type AcademicSnapshot = {
  id: string;
  day: string;
  completed: number;
  overdue: number;
  pending: number;
  study_minutes: number;
};
export type SavedReview = {
  id: string;
  period_start: string;
  period_end: string;
  completed_count: number;
  unfinished_count: number;
  upcoming_count: number;
  study_minutes: number;
  attention_subjects: string[];
  suggested_tasks: string[];
  created_at: string;
};
export type Data = { [K in Table]: EntityMap[K][] } & {
  preferences: Preferences;
  academic_snapshots: AcademicSnapshot[];
  weekly_reviews: SavedReview[];
  announcements: { id: string; title: string; body: string; updated_at: string }[];
};
export const tables: Table[] = [
  'subjects',
  'tasks',
  'subtasks',
  'calendar_events',
  'class_schedules',
  'study_sessions',
  'grade_categories',
  'grades',
  'notifications',
  'activity_history',
  'task_attachments',
];
export const defaultPreferences: Preferences = {
  id: '',
  display_name: 'Student',
  timezone: 'Asia/Manila',
  theme: 'light',
  reminder_hours: [168, 72, 24, 6, 1],
  browser_notifications: false,
  email_notifications: false,
  study_days: [1, 2, 3, 4, 5],
  study_start: '17:00',
  study_end: '21:00',
  session_minutes: 25,
  break_minutes: 5,
  target_grade: 90,
  grading_scale: '90–100 Excellent · 80–89 Very good · 70–79 Good · below 70 Needs attention',
  week_start: 1,
  time_format: '12h',
  date_format: 'medium',
  daily_hours: 3,
  default_priority: 'Auto',
};
export function emptyData(): Data {
  return {
    subjects: [],
    tasks: [],
    subtasks: [],
    calendar_events: [],
    class_schedules: [],
    study_sessions: [],
    grade_categories: [],
    grades: [],
    notifications: [],
    activity_history: [],
    task_attachments: [],
    academic_snapshots: [],
    weekly_reviews: [],
    announcements: [],
    preferences: structuredClone(defaultPreferences),
  };
}
