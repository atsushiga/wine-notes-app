'use server';

import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase';

const COMPLETED = 'completed';
const MIN_PASSWORD_LENGTH = 10;

export async function setPasswordAction(formData: FormData) {
  const password = formData.get('password') as string | null;
  const confirm = formData.get('confirm') as string | null;

  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return { error: 'パスワードは10文字以上で入力してください。' };
  }
  if (password !== confirm) {
    return { error: 'パスワードが一致しません。' };
  }

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_state')
    .eq('id', user.id)
    .single();

  if (profile?.onboarding_state === COMPLETED) {
    redirect('/app');
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    return { error: updateError.message };
  }

  await supabase
    .from('profiles')
    .update({ onboarding_state: COMPLETED, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  redirect('/app');
}
