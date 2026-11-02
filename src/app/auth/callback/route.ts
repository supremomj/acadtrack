import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.has('error')) {
    const message =
      url.searchParams.get('error') === 'access_denied'
        ? 'Sign-in was cancelled or access was denied. Please try again.'
        : 'Sign-in could not be completed. Please try again.';
    const destination = new URL('/login', url.origin);
    destination.searchParams.set('error', message);
    return NextResponse.redirect(destination);
  }
  const code = url.searchParams.get('code');
  if (code) {
    const db = await serverClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(url.searchParams.get('reset') === '1' ? '/login?reset=1' : '/', url.origin),
      );
  }
  return NextResponse.redirect(
    new URL('/login?error=Link%20expired.%20Please%20try%20again.', url.origin),
  );
}
