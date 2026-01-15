// Note: This route requires Google OAuth tokens stored in user profile
// For now, returns a placeholder until Firebase Admin SDK is set up for server-side auth

export async function GET(req) {
    try {
        return new Response(
            JSON.stringify({
                error: 'Email integration is being updated for Firebase. Please reconnect in Settings.',
                needsAuth: true
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('[Email API] Error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
