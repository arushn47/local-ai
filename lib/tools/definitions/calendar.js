/**
 * Calendar Tool - Google Calendar integration
 */

import { TOOL_CATEGORIES } from '../categories.js';

export const calendarTool = {
    name: 'calendar',
    description: 'Read and manage Google Calendar events. Can fetch today, tomorrow, or this week\'s events.',
    category: TOOL_CATEGORIES.SENSITIVE,
    isStub: false,

    parameters: {
        type: 'object',
        properties: {
            timeframe: {
                type: 'string',
                enum: ['today', 'tomorrow', 'week'],
                description: 'Time range to fetch events for'
            },
            operation: {
                type: 'string',
                enum: ['read', 'create'],
                default: 'read',
                description: 'Operation to perform'
            }
        },
        required: ['timeframe']
    },

    async execute(params, context) {
        const { accessToken } = context;
        const { timeframe = 'today', operation = 'read' } = params;

        if (operation === 'create') {
            return {
                error: 'Calendar event creation requires user confirmation',
                requiresConfirmation: true
            };
        }

        try {
            // Call existing calendar API
            const response = await fetch('/api/calendar', {
                headers: accessToken ? {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                } : { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (data.needsAuth) {
                return { error: 'Google Calendar not connected', needsAuth: true };
            }

            if (data.error) {
                return { error: data.error };
            }

            return {
                events: data.events || [],
                formatted: data.formatted || 'No events found',
                timeframe
            };

        } catch (error) {
            return { error: `Calendar fetch failed: ${error.message}` };
        }
    }
};
