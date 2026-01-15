/**
 * Agent Planner - Decomposes user goals into actionable steps
 * 
 * Uses LLM to analyze user intent and create a structured plan
 */

import { PLANNER_PROMPT, formatPrompt } from './prompts.js';

// Simple goals that don't need planning
const SIMPLE_PATTERNS = [
    /^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening))/i,
    /^(thanks|thank you|bye|goodbye)/i,
    /^what('s| is) (your name|time|date)/i,
];

/**
 * Check if a goal is simple enough to skip planning
 */
function isSimpleGoal(goal) {
    const trimmed = goal.trim();

    // Very short messages are usually simple
    if (trimmed.split(/\s+/).length <= 3) {
        return SIMPLE_PATTERNS.some(pattern => pattern.test(trimmed));
    }

    return false;
}

/**
 * Create a simple single-step plan for basic queries
 */
function createSimplePlan(goal) {
    return {
        goal,
        complexity: 'simple',
        steps: [
            { id: 1, action: 'respond', description: 'Respond to user', params: {} }
        ],
        isSimple: true
    };
}

/**
 * Parse LLM response to extract JSON plan
 */
function parsePlannerResponse(response) {
    try {
        // Try direct JSON parse first
        return JSON.parse(response);
    } catch {
        // Try to extract JSON from markdown code block
        const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[1].trim());
        }

        // Try to find JSON object in response
        const objectMatch = response.match(/\{[\s\S]*\}/);
        if (objectMatch) {
            return JSON.parse(objectMatch[0]);
        }

        throw new Error('Could not parse plan from LLM response');
    }
}

/**
 * Validate plan structure
 */
function validatePlan(plan) {
    if (!plan.goal || !Array.isArray(plan.steps)) {
        throw new Error('Invalid plan structure: missing goal or steps');
    }

    if (plan.steps.length === 0) {
        throw new Error('Plan must have at least one step');
    }

    if (plan.steps.length > 5) {
        console.warn('[Planner] Plan has more than 5 steps, truncating');
        plan.steps = plan.steps.slice(0, 5);
    }

    // Ensure each step has required fields
    plan.steps = plan.steps.map((step, idx) => ({
        id: step.id || idx + 1,
        action: step.action || 'respond',
        description: step.description || 'Execute step',
        params: step.params || {}
    }));

    return plan;
}

/**
 * Main planning function - takes a user goal and returns an execution plan
 * 
 * @param {string} goal - User's message/goal
 * @param {object} options - Planning options
 * @param {function} options.llmCall - Function to call LLM (prompt => response)
 * @param {array} options.availableTools - List of available tools
 * @returns {Promise<object>} Execution plan
 */
export async function planGoal(goal, options = {}) {
    const { llmCall, availableTools = [] } = options;

    console.log('[Planner] Planning goal:', goal);

    // Fast path for simple goals
    if (isSimpleGoal(goal)) {
        console.log('[Planner] Simple goal detected, skipping LLM');
        return createSimplePlan(goal);
    }

    // For complex goals, use LLM
    if (!llmCall) {
        console.warn('[Planner] No LLM function provided, using simple plan');
        return createSimplePlan(goal);
    }

    try {
        const prompt = formatPrompt(PLANNER_PROMPT, {
            AVAILABLE_TOOLS: availableTools.map(t => t.name).join(', ')
        });

        const systemPrompt = prompt;
        const userMessage = `User goal: "${goal}"`;

        console.log('[Planner] Calling LLM for plan...');
        const response = await llmCall(systemPrompt, userMessage);

        console.log('[Planner] Raw LLM response:', response.substring(0, 200));

        const plan = parsePlannerResponse(response);
        const validatedPlan = validatePlan(plan);

        console.log('[Planner] Plan created:', JSON.stringify(validatedPlan, null, 2));

        return validatedPlan;

    } catch (error) {
        console.error('[Planner] Error:', error.message);

        // Fallback to simple plan on error
        return {
            goal,
            complexity: 'simple',
            steps: [{ id: 1, action: 'respond', description: 'Respond to user', params: {} }],
            error: error.message
        };
    }
}

/**
 * Detect if a goal requires specific tools based on keywords
 * Used to pre-filter relevant tools before sending to LLM
 */
export function detectRelevantTools(goal, allTools) {
    const lowerGoal = goal.toLowerCase();

    const toolKeywords = {
        calendar: ['calendar', 'schedule', 'meeting', 'event', 'appointment'],
        email: ['email', 'mail', 'inbox', 'send', 'message'],
        notes: ['note', 'notes', 'write down', 'remember'],
        tasks: ['task', 'todo', 'remind', 'reminder'],
        search: ['search', 'look up', 'find', 'google', 'wiki'],
        calculator: ['calculate', 'math', 'compute', '+', '-', '*', '/', '='],
        knowledge: ['knowledge', 'learn', 'remember this', 'what do you know']
    };

    const relevant = [];

    for (const [toolName, keywords] of Object.entries(toolKeywords)) {
        if (keywords.some(kw => lowerGoal.includes(kw))) {
            const tool = allTools.find(t => t.name === toolName);
            if (tool) relevant.push(tool);
        }
    }

    // Always include a few general tools
    const generalTools = ['respond', 'knowledge'];
    for (const name of generalTools) {
        if (!relevant.find(t => t.name === name)) {
            const tool = allTools.find(t => t.name === name);
            if (tool) relevant.push(tool);
        }
    }

    // Limit to 6 tools max
    return relevant.slice(0, 6);
}
