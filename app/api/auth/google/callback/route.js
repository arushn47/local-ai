import { exchangeCodeForTokens } from '@/utils/googleCalendar';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

// Note: This callback needs Firebase Admin SDK for proper server-side auth
// For now, storing in localStorage on redirect

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const userId = searchParams.get('state'); // User ID passed from client

    if (error) {
        return new Response(null, {
            status: 302,
            headers: { Location: '/?error=google_auth_denied' },
        });
    }

    if (!code) {
        return new Response(null, {
            status: 302,
            headers: { Location: '/?error=no_code' },
        });
    }

    try {
        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(code);

        // Store tokens - will be saved client-side via query params
        // This is a temporary solution until Firebase Admin SDK is set up
        const tokenData = encodeURIComponent(JSON.stringify({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: Date.now() + (tokens.expires_in * 1000),
        }));

        return new Response(null, {
            status: 302,
            headers: { Location: `/?success=google_connected&tokens=${tokenData}` },
        });

    } catch (e) {
        console.error('[Google OAuth] Error:', e);
        return new Response(null, {
            status: 302,
            headers: { Location: '/?error=google_auth_failed' },
        });
    }
}
