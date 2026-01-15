/**
 * Tool Registry - Central registry for all agent tools
 * 
 * Features:
 * - OpenAI-style function definitions
 * - Tool limiting (max 5-7 per call based on context)
 * - Safe vs dangerous tool categorization
 */

// Import tool definitions
import { calendarTool } from './definitions/calendar.js';
import { emailTool } from './definitions/email.js';
import { notesTool } from './definitions/notes.js';
import { tasksTool } from './definitions/tasks.js';
import { searchTool } from './definitions/search.js';
import { calculatorTool } from './definitions/calculator.js';
import { knowledgeTool } from './definitions/knowledge.js';
// Stubs - dangerous tools (not implemented)
import { browserTool } from './definitions/browser.js';
import { filesystemTool } from './definitions/filesystem.js';
import { systemTool } from './definitions/system.js';

import { TOOL_CATEGORIES } from './categories.js';
export { TOOL_CATEGORIES };

/**
 * Full tool registry
 */
export const TOOLS = {
    calendar: calendarTool,
    email: emailTool,
    notes: notesTool,
    tasks: tasksTool,
    search: searchTool,
    calculator: calculatorTool,
    knowledge: knowledgeTool,
    // Dangerous stubs
    browser: browserTool,
    filesystem: filesystemTool,
    system: systemTool
};

/**
 * Tool relevance keywords for smart filtering
 */
const TOOL_KEYWORDS = {
    calendar: ['calendar', 'schedule', 'meeting', 'event', 'appointment', 'tomorrow', 'today', 'week'],
    email: ['email', 'mail', 'inbox', 'gmail', 'send', 'message', 'unread'],
    notes: ['note', 'notes', 'write', 'jot', 'remember', 'memo'],
    tasks: ['task', 'todo', 'remind', 'reminder', 'deadline', 'due'],
    search: ['search', 'look up', 'find', 'google', 'web', 'wiki', 'what is', 'who is'],
    calculator: ['calculate', 'math', 'compute', 'solve', '+', '-', '*', '/', '=', 'percent', 'sum'],
    knowledge: ['knowledge', 'learn', 'remember this', 'recall', 'what do you know']
};

/**
 * Calculate relevance score for a tool given a query
 */
function calculateRelevance(toolName, query) {
    const keywords = TOOL_KEYWORDS[toolName] || [];
    const lowerQuery = query.toLowerCase();

    let score = 0;
    for (const keyword of keywords) {
        if (lowerQuery.includes(keyword)) {
            score += keyword.length; // Longer matches score higher
        }
    }

    return score;
}

/**
 * Get active tools for a query, limited to maxTools
 * Only returns relevant tools to avoid overwhelming the LLM
 * 
 * @param {string} query - User's query
 * @param {number} maxTools - Maximum tools to return (default 6)
 * @param {object} options - Options
 * @param {boolean} options.includeDangerous - Include dangerous tool stubs (default false)
 * @returns {array} Array of relevant tools
 */
export function getActiveTools(query, maxTools = 6, options = {}) {
    const { includeDangerous = false } = options;

    // Filter out dangerous tools unless explicitly requested
    const availableTools = Object.entries(TOOLS).filter(([name, tool]) => {
        if (tool.category === TOOL_CATEGORIES.DANGEROUS && !includeDangerous) {
            return false;
        }
        return true;
    });

    // Calculate relevance scores
    const scored = availableTools.map(([name, tool]) => ({
        name,
        tool,
        score: calculateRelevance(name, query)
    }));

    // Sort by relevance (highest first)
    scored.sort((a, b) => b.score - a.score);

    // Always include calculator if math detected
    const hasMath = /[\d+\-*/=]/.test(query);

    // Take top N, but ensure at least one tool if any are relevant
    const result = [];
    for (const { name, tool, score } of scored) {
        if (result.length >= maxTools) break;

        // Include if relevant or it's calculator and math detected
        if (score > 0 || (name === 'calculator' && hasMath)) {
            result.push(tool);
        }
    }

    // If no relevant tools found, include search as fallback
    if (result.length === 0) {
        result.push(TOOLS.search);
    }

    return result;
}

/**
 * Get tool by name
 */
export function getTool(name) {
    return TOOLS[name] || null;
}

/**
 * Get all safe tools (for unrestricted contexts)
 */
export function getSafeTools() {
    return Object.values(TOOLS).filter(t => t.category === TOOL_CATEGORIES.SAFE);
}

/**
 * Get tool schemas for LLM prompt injection
 */
export function getToolSchemas(tools) {
    return tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
    }));
}

/**
 * Format tools for prompt injection
 */
export function formatToolsForPrompt(tools) {
    return tools.map(t =>
        `- **${t.name}**: ${t.description}\n  Parameters: ${JSON.stringify(t.parameters)}`
    ).join('\n\n');
}

/**
 * Execute a tool by name with context
 */
export async function executeToolByName(toolName, params, context) {
    const tool = TOOLS[toolName];

    if (!tool) {
        return { error: `Unknown tool: ${toolName}`, success: false };
    }

    // Block dangerous tools
    if (tool.category === TOOL_CATEGORIES.DANGEROUS && !tool.isStub) {
        return {
            error: `Tool ${toolName} requires explicit user confirmation`,
            blocked: true,
            success: false
        };
    }

    try {
        const result = await tool.execute(params, context);
        return { result, success: true };
    } catch (error) {
        return { error: error.message, success: false };
    }
}
