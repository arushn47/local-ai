/**
 * System Tool - STUB - System commands (NOT IMPLEMENTED)
 * 
 * CAUTION: This is a stub. Before implementing:
 * - Require explicit user confirmation for EVERY command
 * - Heavily sandbox execution
 * - Audit log all operations
 * - Whitelist allowed commands only
 * - Never run anything destructive
 */

import { TOOL_CATEGORIES } from '../categories.js';

export const systemTool = {
    name: 'system',
    description: '[STUB] Execute system commands. NOT YET IMPLEMENTED.',
    category: TOOL_CATEGORIES.DANGEROUS,
    isStub: true,

    parameters: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'Command to execute'
            },
            args: {
                type: 'array',
                items: { type: 'string' },
                description: 'Command arguments'
            }
        },
        required: ['command']
    },

    async execute(params, context) {
        return {
            error: 'System tool is not implemented yet',
            isStub: true,
            message: 'This tool is extremely dangerous and requires maximum security measures before activation.'
        };
    }
};
