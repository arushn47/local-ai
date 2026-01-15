/**
 * Knowledge Tool - RAG-based knowledge storage and retrieval
 */

import { TOOL_CATEGORIES } from '../categories.js';

export const knowledgeTool = {
    name: 'knowledge',
    description: 'Store information for later recall, or query stored knowledge.',
    category: TOOL_CATEGORIES.SAFE,
    isStub: false,

    parameters: {
        type: 'object',
        properties: {
            operation: {
                type: 'string',
                enum: ['store', 'query'],
                description: 'Operation: store new knowledge or query existing'
            },
            content: {
                type: 'string',
                description: 'Content to store or query to search'
            },
            documentName: {
                type: 'string',
                description: 'Name for stored document (optional)'
            }
        },
        required: ['operation', 'content']
    },

    async execute(params, context) {
        const { accessToken } = context;
        const { operation, content, documentName } = params;

        if (!content) {
            return { error: 'Content required' };
        }

        const headers = accessToken
            ? { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
            : { 'Content-Type': 'application/json' };

        try {
            if (operation === 'store') {
                const name = documentName || `Note ${new Date().toLocaleString()}`;

                const response = await fetch('/api/knowledge', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ documentName: name, text: content })
                });

                const data = await response.json();

                if (data.error) {
                    return { error: data.error };
                }

                return {
                    success: true,
                    message: `Stored as "${name}"`,
                    documentName: name
                };

            } else if (operation === 'query') {
                const response = await fetch(`/api/knowledge?q=${encodeURIComponent(content)}`, {
                    headers
                });

                const data = await response.json();

                if (data.error) {
                    return { error: data.error };
                }

                return {
                    results: data.results || [],
                    formatted: data.formatted || 'No relevant knowledge found',
                    query: content
                };

            } else {
                return { error: `Unknown operation: ${operation}` };
            }

        } catch (error) {
            return { error: `Knowledge operation failed: ${error.message}` };
        }
    }
};
