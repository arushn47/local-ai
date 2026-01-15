/**
 * Calculator Tool - Math calculations
 */

import { TOOL_CATEGORIES } from '../registry.js';

export const calculatorTool = {
    name: 'calculator',
    description: 'Perform mathematical calculations. Supports basic arithmetic and percentages.',
    category: TOOL_CATEGORIES.SAFE,
    isStub: false,

    parameters: {
        type: 'object',
        properties: {
            expression: {
                type: 'string',
                description: 'Mathematical expression to evaluate (e.g., "25 * 17" or "15% of 200")'
            }
        },
        required: ['expression']
    },

    async execute(params, context) {
        const { expression } = params;

        if (!expression) {
            return { error: 'Expression required' };
        }

        try {
            // Handle percentage expressions
            let expr = expression;
            const percentMatch = expr.match(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/i);
            if (percentMatch) {
                const [_, percent, value] = percentMatch;
                expr = `(${percent} / 100) * ${value}`;
            }

            // Sanitize: only allow numbers and math operators
            const cleanExpr = expr.replace(/[^0-9+\-*/().%\s]/g, '');
            if (!cleanExpr) {
                return { error: 'Invalid expression' };
            }

            // Safe evaluation using Function
            // eslint-disable-next-line no-new-func
            const result = new Function(`return (${cleanExpr})`)();

            if (!isFinite(result) || isNaN(result)) {
                return { error: 'Invalid calculation result' };
            }

            // Round to reasonable precision
            const rounded = Math.round(result * 1000000) / 1000000;

            return {
                expression: expression,
                result: rounded,
                formatted: `${expression} = ${rounded}`
            };

        } catch (error) {
            return { error: `Calculation failed: ${error.message}` };
        }
    }
};
