/**
 * Email Tool - Gmail integration
 */

import { TOOL_CATEGORIES } from '../categories.js';

export const emailTool = {
    name: 'email',
    description: 'Read emails from Gmail inbox. Can fetch recent or unread messages.',
    category: TOOL_CATEGORIES.SENSITIVE,
    isStub: false,

    parameters: {
        type: 'object',
        properties: {
            filter: {
                type: 'string',
                enum: ['recent', 'unread', 'all'],
                default: 'recent',
                description: 'Email filter'
            },
            limit: {
                type: 'number',
                default: 5,
                description: 'Maximum emails to return'
            }
        }
    },

    async execute(params, context) {
        const { accessToken } = context;
        const { filter = 'recent', limit = 5 } = params;

        try {
            const response = await fetch('/api/email', {
                headers: accessToken ? {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                } : { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (data.needsAuth) {
                return { error: 'Gmail not connected', needsAuth: true };
            }

            if (data.error) {
                return { error: data.error };
            }

            return {
                emails: (data.emails || []).slice(0, limit),
                formatted: data.formatted || 'No emails found',
                filter
            };

        } catch (error) {
            return { error: `Email fetch failed: ${error.message}` };
        }
    }
};
