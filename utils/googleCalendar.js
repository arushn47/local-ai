/**
 * Google Calendar Integration
 * Uses Google Calendar API with OAuth2
 */

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
    : 'http://localhost:3000/api/auth/google/callback';

/**
 * Generate Google OAuth URL for Calendar access
 */
export const getGoogleAuthUrl = (accessToken) => {
    if (!GOOGLE_CLIENT_ID) {
        console.error('[Google] Missing GOOGLE_CLIENT_ID');
        return null;
    }

    // Don't pre-encode - URLSearchParams handles encoding
    const scope = [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events',
    ].join(' ');

    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope,
        access_type: 'offline',
        prompt: 'consent',
        state: accessToken, // Pass token to persist session in callback
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

/**
 * Exchange authorization code for tokens
 */
export const exchangeCodeForTokens = async (code) => {
    console.log('[Google Auth] Exchanging code...', {
        clientIdStart: GOOGLE_CLIENT_ID?.substring(0, 5),
        hasSecret: !!GOOGLE_CLIENT_SECRET,
        secretLength: GOOGLE_CLIENT_SECRET?.length
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code',
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Google OAuth] Token exchange failed:', response.status, errorData);
        throw new Error(`Failed to exchange code for tokens: ${JSON.stringify(errorData)}`);
    }

    return response.json();
};

/**
 * Refresh access token
 */
export const refreshAccessToken = async (refreshToken) => {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            refresh_token: refreshToken,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            grant_type: 'refresh_token',
        }),
    });

    if (!response.ok) {
        throw new Error('Failed to refresh token');
    }

    return response.json();
};

/**
 * Get calendar events
 */
export const getCalendarEvents = async (accessToken, options = {}) => {
    const { maxResults = 10, timeMin, timeMax } = options;

    const params = new URLSearchParams({
        maxResults: String(maxResults),
        singleEvents: 'true',
        orderBy: 'startTime',
        timeMin: timeMin || new Date().toISOString(),
    });

    if (timeMax) {
        params.append('timeMax', timeMax);
    }

    const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        }
    );

    if (!response.ok) {
        throw new Error('Failed to fetch calendar events');
    }

    const data = await response.json();
    return data.items || [];
};

/**
 * Create a calendar event
 */
export const createCalendarEvent = async (accessToken, event) => {
    const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
        }
    );

    if (!response.ok) {
        throw new Error('Failed to create calendar event');
    }

    return response.json();
};

/**
 * Format events for AI context
 */
export const formatEventsForAI = (events) => {
    if (!events || events.length === 0) {
        return '[No upcoming events found]';
    }

    let formatted = '[Your Calendar]\n\n';

    for (const event of events) {
        const start = event.start?.dateTime || event.start?.date;
        const end = event.end?.dateTime || event.end?.date;

        const startDate = new Date(start);
        const dateStr = startDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });
        const timeStr = event.start?.dateTime
            ? startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            : 'All day';

        formatted += `• ${dateStr} at ${timeStr}: ${event.summary || 'Untitled'}\n`;
        if (event.location) {
            formatted += `  📍 ${event.location}\n`;
        }
    }

    return formatted;
};
