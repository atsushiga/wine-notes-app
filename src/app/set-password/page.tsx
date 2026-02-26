import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase';
import { SetPasswordForm } from './SetPasswordForm';

const COMPLETED = 'completed';

export default async function SetPasswordPage() {
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

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center px-4">
      <h1 className="text-xl font-semibold text-[var(--text)]">パスワードを設定</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        10文字以上のパスワードを設定してください。
      </p>
      <SetPasswordForm />
    </div>
  );
}
