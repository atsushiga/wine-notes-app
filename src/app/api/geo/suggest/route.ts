import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

// Explicit country mapping as required
const COUNTRY_MAP: Record<string, string | null> = {
    'フランス': 'France',
    'イタリア': 'Italy',
    'スペイン': 'Spain',
    'ドイツ': 'Germany',
    'アメリカ': 'US',
    'カナダ': 'Canada',
    'チリ': 'Chile',
    'アルゼンチン': 'Argentina',
    'オーストラリア': 'Australia',
    'ニュージーランド': 'New Zealand',
    '日本': 'Japan',
    '南アフリカ': 'South Africa',
    'ポルトガル': 'Portugal',
    'ギリシャ': 'Greece',
    'ジョージア': 'Georgia',
    'その他': null
};

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q');
    const countryJa = searchParams.get('country_ja');
    const limit = parseInt(searchParams.get('limit') || '12', 10);

    // Validation: q must be at least 2 chars
    if (!q || q.length < 2) {
        return NextResponse.json([]);
    }

    const supabase = getSupabaseClient();
    const qNorm = q.trim().toLowerCase();

    // Resolve country filter
    let targetCountry: string | null = null;
    if (countryJa && COUNTRY_MAP[countryJa] !== undefined) {
        targetCountry = COUNTRY_MAP[countryJa]; // Can be null if 'その他'
    }

    try {
        const { data, error } = await supabase.rpc('search_geo_vocab', {
            search_term: qNorm,
            target_country: targetCountry,
            max_results: limit
        });

        if (error) {
            console.error('RPC Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (e) {
        console.error('Suggest API Error:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
