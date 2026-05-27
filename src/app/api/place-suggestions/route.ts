import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        let query = supabase
            .from('tasting_notes')
            .select('place, created_at')
            .not('place', 'is', null)
            .neq('place', '')
            .order('created_at', { ascending: false })
            .limit(500);

        if (user) {
            query = query.eq('user_id', user.id);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Place suggestions error:', error);
            return NextResponse.json({ suggestions: [] }, { status: 200 });
        }

        const seen = new Set<string>();
        const suggestions: string[] = [];

        for (const row of data || []) {
            const place = typeof row.place === 'string' ? row.place.trim() : '';
            if (!place || seen.has(place)) continue;

            seen.add(place);
            suggestions.push(place);

            if (suggestions.length >= 10) break;
        }

        return NextResponse.json({ suggestions }, { status: 200 });
    } catch (error) {
        console.error('Place suggestions unexpected error:', error);
        return NextResponse.json({ suggestions: [] }, { status: 200 });
    }
}
