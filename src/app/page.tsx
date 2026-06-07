import { createClient } from '@/utils/supabase/server';
import WineEntryClient, { InputMode } from './WineEntryClient';
import { defaultSimpleAiAutomationSettings, type SimpleAiAutomationSettings } from '@/lib/simpleAiAutomation';

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let defaultInputMode: InputMode = 'simple';
  let simpleAiAutomation: SimpleAiAutomationSettings = defaultSimpleAiAutomationSettings;

  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('default_input_mode, simple_auto_image_optimize, simple_auto_wine_name_search, simple_auto_ai_info')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.warn('profile preferences are not available; falling back to defaults.', profileError.message);
    } else if (profile?.default_input_mode === 'detailed') {
      defaultInputMode = 'detailed';
    }

    if (!profileError && profile) {
      const wineNameSearch = profile.simple_auto_wine_name_search !== false;
      simpleAiAutomation = {
        imageOptimize: profile.simple_auto_image_optimize !== false,
        wineNameSearch,
        aiInfo: wineNameSearch && profile.simple_auto_ai_info !== false,
      };
    }
  }

  return <WineEntryClient defaultInputMode={defaultInputMode} simpleAiAutomation={simpleAiAutomation} />;
}
