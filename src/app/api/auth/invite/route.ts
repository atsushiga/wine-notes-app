import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

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
  if (!email) {
    return NextResponse.json({ ok: true });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ ok: true });
  }

  try {
    const supabase = getSupabaseClient();
    await supabase.auth.admin.inviteUserByEmail(email, { redirectTo });
  } catch {
    // Do not reveal whether email exists or invite failed
  }

  return NextResponse.json({ ok: true });
}
