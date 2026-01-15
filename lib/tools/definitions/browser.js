/**
 * Browser Tool - STUB - Web browsing (NOT IMPLEMENTED)
 * 
 * CAUTION: This is a stub. Before implementing:
 * - Require explicit user confirmation per action
 * - Sandbox execution environment
 * - Audit log all operations
 * - Whitelist allowed domains
 */

import { TOOL_CATEGORIES } from '../registry.js';

export const browserTool = {
    name: 'browser',
    description: '[STUB] Browse websites and extract information. NOT YET IMPLEMENTED.',
    category: TOOL_CATEGORIES.DANGEROUS,
    isStub: true,

    parameters: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'URL to browse'
            },
            action: {
                type: 'string',
                enum: ['read', 'click', 'type'],
                description: 'Browser action'
            }
        },
        required: ['url']
    },

    async execute(params, context) {
        return {
            error: 'Browser tool is not implemented yet',
            isStub: true,
            message: 'This tool requires additional security measures before activation.'
        };
    }
};
