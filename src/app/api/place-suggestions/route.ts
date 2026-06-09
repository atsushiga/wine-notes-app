import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isAuthenticationRequiredError, requireAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const user = await requireAuthenticatedUser();
        const supabase = await createClient();

        const query = supabase
            .from('tasting_notes')
            .select('place, created_at')
            .not('place', 'is', null)
            .neq('place', '')
            .order('created_at', { ascending: false })
            .limit(500)
            .eq('user_id', user.id);

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
        if (isAuthenticationRequiredError(error)) {
            return NextResponse.json({ suggestions: [] }, { status: 401 });
        }

        console.error('Place suggestions unexpected error:', error);
        return NextResponse.json({ suggestions: [] }, { status: 200 });
    }
}
