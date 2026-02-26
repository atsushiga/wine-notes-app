import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

const COMPLETED = 'completed';

function loginErrorRedirect(request: NextRequest, reason: string) {
  const base = new URL('/login', request.url);
  base.searchParams.set('error', reason);
  return NextResponse.redirect(base);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/app';

  if (!code) {
    return new NextResponse(getCallbackHtml(), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const url = new URL(request.url);
  const response = NextResponse.next({ request: { headers: request.headers } });
  const savedCookies: { name: string; value: string; options?: Record<string, unknown> }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            savedCookies.push({ name, value, options });
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return loginErrorRedirect(request, 'exchange_failed');
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return loginErrorRedirect(request, 'no_user');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_state')
    .eq('id', user.id)
    .single();

  const state = profile?.onboarding_state ?? 'pending';
  const redirectUrl = state === COMPLETED ? new URL(next, url.origin) : new URL('/set-password', url.origin);
  const redirectResponse = NextResponse.redirect(redirectUrl);

  savedCookies.forEach(({ name, value, options }) => {
    redirectResponse.cookies.set(name, value, options ?? { path: '/' });
  });

  return redirectResponse;
}

function getCallbackHtml(): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>認証中</title></head><body>
<p>認証を完了しています...</p>
<script>
(function() {
  var hash = window.location.hash.slice(1);
  if (!hash) { window.location.replace('/login?error=invalid_callback'); return; }
  var params = new URLSearchParams(hash);
  var access_token = params.get('access_token');
  var refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) { window.location.replace('/login?error=invalid_callback'); return; }
  fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: access_token, refresh_token: refresh_token }),
    credentials: 'same-origin'
  }).then(function(r) {
    if (r.ok) { window.location.replace('/set-password'); }
    else { window.location.replace('/login?error=exchange_failed'); }
  }).catch(function() { window.location.replace('/login?error=exchange_failed'); });
})();
</script>
</body></html>`;
}
