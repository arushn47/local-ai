/**
 * Search Tool - Web search via existing search API
 */

import { TOOL_CATEGORIES } from '../registry.js';

export const searchTool = {
    name: 'search',
    description: 'Search the web for information. Returns summarized results.',
    category: TOOL_CATEGORIES.SAFE,
    isStub: false,

    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Search query'
            },
            limit: {
                type: 'number',
                default: 5,
                description: 'Maximum results to return'
            }
        },
        required: ['query']
    },

    async execute(params, context) {
        const { query, limit = 5 } = params;

        if (!query) {
            return { error: 'Search query required' };
        }

        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=${limit}`);
            const data = await response.json();

            if (data.error) {
                return { error: data.error };
            }

            return {
                results: data.results || [],
                formatted: data.formatted || 'No results found',
                query
            };

        } catch (error) {
            return { error: `Search failed: ${error.message}` };
        }
    }
};
