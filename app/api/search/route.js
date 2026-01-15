export const dynamic = 'force-dynamic';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.get('q');

        if (!query) {
            return new Response(
                JSON.stringify({ error: 'Query parameter "q" is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // DuckDuckGo Instant Answer API
        const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

        const response = await fetch(ddgUrl, {
            headers: {
                'User-Agent': 'LocalMind/1.0'
            }
        });

        if (!response.ok) {
            throw new Error(`DuckDuckGo API error: ${response.status}`);
        }

        const data = await response.json();

        return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('[Search API] Error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
