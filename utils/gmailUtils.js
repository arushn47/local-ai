/**
 * Gmail Integration Utilities
 * Uses Gmail API with existing Google OAuth
 */

/**
 * Get recent emails from Gmail
 */
export const getRecentEmails = async (accessToken, options = {}) => {
    const { maxResults = 10, labelIds = ['INBOX'], query = 'is:unread' } = options;

    const params = new URLSearchParams({
        maxResults: String(maxResults),
        labelIds: labelIds.join(','),
        q: query,
    });

    const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        }
    );

    if (!response.ok) {
        throw new Error('Failed to fetch emails');
    }

    const data = await response.json();
    return data.messages || [];
};

/**
 * Get email details
 */
export const getEmailDetails = async (accessToken, messageId) => {
    const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        }
    );

    if (!response.ok) {
        throw new Error('Failed to fetch email details');
    }

    return response.json();
};

/**
 * Get full email content (for summarization)
 */
export const getEmailContent = async (accessToken, messageId) => {
    const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        }
    );

    if (!response.ok) {
        throw new Error('Failed to fetch email content');
    }

    const data = await response.json();

    // Extract plain text content
    let content = '';
    const payload = data.payload;

    if (payload.body?.data) {
        content = atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    } else if (payload.parts) {
        for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
                content = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                break;
            }
        }
    }

    return {
        ...data,
        textContent: content,
    };
};

/**
 * Format emails for AI context
 */
export const formatEmailsForAI = (emails, details) => {
    if (!emails || emails.length === 0) {
        return '[No unread emails found]';
    }

    let formatted = '[Your Emails]\n\n';

    for (const detail of details) {
        const headers = detail.payload?.headers || [];
        const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
        const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
        const date = headers.find(h => h.name === 'Date')?.value || '';

        // Parse sender name
        const senderMatch = from.match(/^([^<]+)/);
        const senderName = senderMatch ? senderMatch[1].trim() : from;

        // Format date
        let dateStr = '';
        if (date) {
            try {
                const d = new Date(date);
                dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } catch {
                dateStr = date;
            }
        }

        formatted += `• From: ${senderName}\n`;
        formatted += `  Subject: ${subject}\n`;
        if (dateStr) formatted += `  Date: ${dateStr}\n`;
        formatted += '\n';
    }

    return formatted;
};
