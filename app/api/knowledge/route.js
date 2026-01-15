// Knowledge Base API - temporarily disabled during Firebase migration
// TODO: Re-implement with Firebase Admin SDK for server-side auth

export async function GET(req) {
    return new Response(
        JSON.stringify({
            error: 'Knowledge base is being updated for Firebase.',
            formatted: null
        }),
        { headers: { 'Content-Type': 'application/json' } }
    );
}

export async function POST(req) {
    return new Response(
        JSON.stringify({
            error: 'Knowledge base is being updated for Firebase.',
            success: false
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
}
