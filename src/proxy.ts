import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { workspaceAccess } from '@/lib/access';
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    return response;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user && request.nextUrl.pathname === '/')
    return NextResponse.redirect(new URL('/login', request.url));
  if (user && request.nextUrl.pathname === '/') {
    try {
      const access = await workspaceAccess(supabase, user);
      if (!access.allowed)
        return NextResponse.redirect(
          new URL(`/login?${access.suspended ? 'suspended' : 'verify'}=1`, request.url),
        );
    } catch {
      return NextResponse.redirect(
        new URL(
          '/login?error=Could%20not%20verify%20account%20access.%20Please%20try%20again.',
          request.url,
        ),
      );
    }
  }
  return response;
}
export const config = {
  matcher: ['/', '/api/data', '/api/records', '/api/account', '/api/upload'],
};
