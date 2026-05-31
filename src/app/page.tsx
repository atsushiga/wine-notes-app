import { createClient } from '@/utils/supabase/server';
import WineEntryClient, { InputMode } from './WineEntryClient';

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let defaultInputMode: InputMode = 'simple';

  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('default_input_mode')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.warn('default_input_mode is not available; falling back to simple mode.', profileError.message);
    } else if (profile?.default_input_mode === 'detailed') {
      defaultInputMode = 'detailed';
    }
  }

  return <WineEntryClient defaultInputMode={defaultInputMode} />;
}
