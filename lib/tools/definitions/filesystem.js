/**
 * Filesystem Tool - STUB - File operations (NOT IMPLEMENTED)
 * 
 * CAUTION: This is a stub. Before implementing:
 * - Require explicit user confirmation per action
 * - Sandbox execution to specific directories
 * - Audit log all operations
 * - Whitelist allowed paths
 * - Never allow deletion without confirmation
 */

import { TOOL_CATEGORIES } from '../categories.js';

export const filesystemTool = {
    name: 'filesystem',
    description: '[STUB] Read and write files. NOT YET IMPLEMENTED.',
    category: TOOL_CATEGORIES.DANGEROUS,
    isStub: true,

    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'File path'
            },
            operation: {
                type: 'string',
                enum: ['read', 'write', 'list', 'delete'],
                description: 'File operation'
            },
            content: {
                type: 'string',
                description: 'Content to write (for write operation)'
            }
        },
        required: ['path', 'operation']
    },

    async execute(params, context) {
        return {
            error: 'Filesystem tool is not implemented yet',
            isStub: true,
            message: 'This tool requires sandbox environment and user confirmation before activation.'
        };
    }
};
