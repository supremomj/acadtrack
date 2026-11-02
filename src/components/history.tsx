'use client';
import { useWorkspace } from './workspace-provider';
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { dateLabel } from '@/lib/utils';
export function AnalyticsHistory() {
  const { data, mode } = useWorkspace(),
    rows = [...data.academic_snapshots].sort((a, b) => a.day.localeCompare(b.day)).slice(-28);
  return (
    <section className="panel panel-padding">
      <h2>Deadline health over time</h2>
      {rows.length ? (
        <div className="chart-container tall">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="day" tickFormatter={(d) => d.slice(5)} tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Area dataKey="overdue" stroke="#ce827b" fill="#ce827b20" name="Overdue" />
              <Area dataKey="pending" stroke="#8b83ca" fill="#8b83ca10" name="Pending" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="muted small">
          {mode === 'cloud'
            ? 'Daily snapshots start when the server scheduler runs. History builds from real records over time.'
            : 'Historical deadline snapshots are collected by the cloud scheduler once Supabase is configured.'}
        </p>
      )}
    </section>
  );
}
export function ReviewHistory() {
  const { data } = useWorkspace(),
    reviews = [...data.weekly_reviews].sort((a, b) => b.period_start.localeCompare(a.period_start));
  if (!reviews.length) return null;
  return (
    <section className="panel panel-padding">
      <h2>Previous weekly check-ins</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Week of</th>
              <th>Completed</th>
              <th>Unfinished at review</th>
              <th>Study time</th>
            </tr>
          </thead>
          <tbody>
            {reviews.slice(0, 12).map((r) => (
              <tr key={r.id}>
                <td>{dateLabel(`${r.period_start}T12:00:00Z`, data.preferences.timezone)}</td>
                <td>{r.completed_count}</td>
                <td>{r.unfinished_count}</td>
                <td>{(Number(r.study_minutes) / 60).toFixed(1)}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
