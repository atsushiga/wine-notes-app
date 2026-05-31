import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const COMPLETED = 'completed';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USER_LOOKUP_PAGE_SIZE = 100;
const MAX_USER_LOOKUP_PAGES = 20;

type AuthErrorLike = {
  code?: string;
  message?: string;
  name?: string;
  status?: number;
};

function logEmailLinkError(error: AuthErrorLike) {
  console.error('Failed to send signup email link', {
    code: error.code,
    name: error.name,
    status: error.status,
    message: error.message,
  });
}

async function findUserByEmail(
  supabase: SupabaseClient,
  email: string,
) {
  for (let page = 1; page <= MAX_USER_LOOKUP_PAGES; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: USER_LOOKUP_PAGE_SIZE,
    });

    if (error) {
      throw error;
    }

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user || data.users.length < USER_LOOKUP_PAGE_SIZE) {
      return user ?? null;
    }
  }

  console.error('User lookup reached the pagination limit before finding a matching email.');
  throw new Error('User lookup limit exceeded');
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin') || request.nextUrl.origin;
  const redirectTo = `${origin}/auth/callback`;

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null;
  if (!email || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    console.error('Supabase auth environment variables are missing. Signup email link was not sent.');
    return NextResponse.json({ ok: false, error: 'auth_not_configured' }, { status: 503 });
  }

  try {
    const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const existingUser = await findUserByEmail(adminSupabase, email);

    if (existingUser) {
      const { data: profile, error: profileError } = await adminSupabase
        .from('profiles')
        .select('onboarding_state')
        .eq('id', existingUser.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (profile?.onboarding_state === COMPLETED) {
        return NextResponse.json({ ok: false, error: 'account_exists' }, { status: 409 });
      }
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true,
      },
    });

    if (error) {
      logEmailLinkError(error);
      return NextResponse.json(
        { ok: false, error: error.code ?? 'email_link_failed' },
        { status: error.status ?? 502 },
      );
    }
  } catch (error) {
    logEmailLinkError(error instanceof Error ? error : { message: String(error) });
    return NextResponse.json({ ok: false, error: 'email_link_failed' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
