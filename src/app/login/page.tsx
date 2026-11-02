'use client';
import { useState, useEffect } from 'react';
import { GraduationCap, ArrowRight, CheckCircle2 } from 'lucide-react';
import { browserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
export default function Login() {
  const [mode, setMode] = useState<'login' | 'register' | 'reset' | 'new-password'>('login'),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const configured = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get('reset')) setMode('new-password');
    if (q.get('error')) setMessage(q.get('error')!);
    if (q.get('verify'))
      setMessage(
        'Confirm your email before signing in. Check your inbox for the verification link.',
      );
    if (q.get('suspended'))
      setMessage('Your account is suspended. Contact the site administrator.');
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage('');
    const f = new FormData(e.currentTarget);
    try {
      const db = browserClient(),
        email = String(f.get('email')),
        password = String(f.get('password'));
      const result =
        mode === 'login'
          ? await db.auth.signInWithPassword({ email, password })
          : mode === 'register'
            ? await db.auth.signUp({
                email,
                password,
                options: { emailRedirectTo: `${location.origin}/auth/callback` },
              })
            : mode === 'reset'
              ? await db.auth.resetPasswordForEmail(email, {
                  redirectTo: `${location.origin}/auth/callback?reset=1`,
                })
              : await db.auth.updateUser({ password });
      if (result.error) throw result.error;
      if (mode === 'login' || mode === 'new-password') location.href = '/';
      else
        setMessage(
          mode === 'register'
            ? 'Check your email to confirm your account.'
            : 'Password reset link sent. Check your email.',
        );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <div className="auth-theme-toggle">
        <ThemeToggle />
      </div>
      <div className="auth-story">
        <a className="brand" href="/">
          <span className="brand-icon">
            <GraduationCap />
          </span>
          AcadTrack<span className="brand-dot">.</span>
        </a>
        <div>
          <span className="eyebrow">A LITTLE STRUCTURE. A LOT MORE POSSIBILITY.</span>
          <h1>
            Your academic life.
            <br />A little more
            <br />
            <em>under control.</em>
          </h1>
          <p>Make a plan, find your focus, and give your best work the space it deserves.</p>
          <div className="auth-benefits">
            {[
              'Every deadline, in one place',
              'Study plans that fit your life',
              'Progress you can actually see',
            ].map((t) => (
              <span key={t}>
                <CheckCircle2 size={18} />
                {t}
              </span>
            ))}
          </div>
        </div>
        <small>BUILT FOR YOUR NEXT CHAPTER</small>
      </div>
      <div className="auth-form">
        <div className="auth-box">
          <span className="eyebrow">YOUR PERSONAL ACADEMIC WORKSPACE</span>
          <h2>
            {mode === 'register'
              ? 'Start your next chapter'
              : mode === 'reset'
                ? 'Let’s get you back in'
                : mode === 'new-password'
                  ? 'Choose a new password'
                  : 'Welcome back'}
          </h2>
          <p>
            {configured
              ? 'A clear plan for everything ahead.'
              : 'Start locally, or configure Supabase to enable secure accounts.'}
          </p>
          {configured ? (
            <form onSubmit={submit}>
              {mode !== 'new-password' && (
                <label>
                  Email address
                  <input
                    name="email"
                    type="email"
                    placeholder="you@university.edu"
                    required
                    autoComplete="email"
                  />
                </label>
              )}
              {mode !== 'reset' && (
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    minLength={8}
                    required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    placeholder="At least 8 characters"
                  />
                </label>
              )}
              <Button disabled={busy}>
                {busy
                  ? 'Please wait…'
                  : mode === 'register'
                    ? 'Create account'
                    : mode === 'reset'
                      ? 'Send reset link'
                      : mode === 'new-password'
                        ? 'Update password'
                        : 'Sign in'}
                <ArrowRight size={17} />
              </Button>
            </form>
          ) : (
            <Button asChild>
              <a href="/">
                Open local workspace <ArrowRight size={17} />
              </a>
            </Button>
          )}
          {message && (
            <p role="status" className="form-message">
              {message}
            </p>
          )}
          {configured && (
            <div className="auth-links">
              <button
                disabled={busy}
                onClick={() => {
                  setMessage('');
                  setMode(mode === 'login' ? 'register' : 'login');
                }}
              >
                {mode === 'login'
                  ? 'New here? Create an account'
                  : 'Already have an account? Sign in'}
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setMessage('');
                  setMode('reset');
                }}
              >
                Forgot password?
              </button>
            </div>
          )}
          <small>Your pace. Your plan. Your progress.</small>
        </div>
      </div>
    </main>
  );
}
