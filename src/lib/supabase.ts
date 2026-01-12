import { createClient, SupabaseClient } from '@supabase/supabase-js';

// サーバーサイド用のSupabaseクライアントを取得する関数
export function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const missingVars = [];
    if (!supabaseUrl) missingVars.push('NEXT_PUBLIC_SUPABASE_URL (または SUPABASE_URL)');
    if (!supabaseAnonKey) missingVars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY (または SUPABASE_ANON_KEY)');
    
    // デバッグ情報を出力
    console.error('=== 環境変数デバッグ情報 ===');
    console.error('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '設定済み' : '未設定');
    console.error('SUPABASE_URL:', process.env.SUPABASE_URL ? '設定済み' : '未設定');
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '設定済み' : '未設定');
    console.error('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '設定済み' : '未設定');
    console.error('==========================');
    
    throw new Error(
      `Supabase環境変数が設定されていません。\n` +
      `不足している変数: ${missingVars.join(', ')}\n` +
      `プロジェクトルートに .env.local ファイルを作成し、以下の環境変数を設定してください:\n` +
      `  NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url\n` +
      `  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key\n` +
      `注意: 値に引用符（"や'）は不要です。また、環境変数を変更した場合は開発サーバーを再起動してください。`
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

// クライアントサイド用（既存のコードとの互換性のため）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };
