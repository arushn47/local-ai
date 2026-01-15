/**
 * Agent Executor - Multi-step agent loop with observe → decide → act cycle
 * 
 * Features:
 * - Structured logging for Agent Run Inspector UI
 * - Max iteration limits
 * - Timeout handling
 * - Error recovery
 */

import { OBSERVER_PROMPT, FINAL_ANSWER_PROMPT, formatPrompt } from './prompts.js';

// Configuration
const MAX_ITERATIONS = 5;
const STEP_TIMEOUT_MS = 30000;

// Run logs storage (in-memory, can be persisted later)
const agentRunLogs = new Map();

/**
 * Structured log entry for agent inspector UI
 */
function logStep(runId, step) {
    if (!agentRunLogs.has(runId)) {
        agentRunLogs.set(runId, []);
    }

    const entry = {
        runId,
        timestamp: Date.now(),
        type: step.type,  // 'plan' | 'tool_call' | 'tool_result' | 'decision' | 'error' | 'final'
        data: step.data
    };

    agentRunLogs.get(runId).push(entry);
    console.log(`[Agent][${runId}] ${step.type}:`, JSON.stringify(step.data).substring(0, 200));

    return entry;
}

/**
 * Get logs for a specific run (for inspector UI)
 */
export function getRunLogs(runId) {
    return agentRunLogs.get(runId) || [];
}

/**
 * Clear old run logs (call periodically)
 */
export function cleanupOldLogs(maxAgeMs = 3600000) {
    const now = Date.now();
    for (const [runId, logs] of agentRunLogs.entries()) {
        if (logs.length > 0 && now - logs[0].timestamp > maxAgeMs) {
            agentRunLogs.delete(runId);
        }
    }
}

/**
 * Execute a single tool with timeout
 */
async function executeToolWithTimeout(tool, params, context, timeoutMs = STEP_TIMEOUT_MS) {
    return Promise.race([
        tool.execute(params, context),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Tool ${tool.name} timed out after ${timeoutMs}ms`)), timeoutMs)
        )
    ]);
}

/**
 * Decide what to do after observing tool result
 */
async function observeAndDecide(plan, stepIndex, toolResult, llmCall) {
    const prompt = formatPrompt(OBSERVER_PROMPT, {
        GOAL: plan.goal,
        CURRENT_STEP: stepIndex + 1,
        TOTAL_STEPS: plan.steps.length,
        TOOL_NAME: plan.steps[stepIndex].action,
        TOOL_RESULT: JSON.stringify(toolResult),
        REMAINING_STEPS: JSON.stringify(plan.steps.slice(stepIndex + 1))
    });

    try {
        const response = await llmCall(prompt, 'Analyze and decide next action.');
        const decision = JSON.parse(response.match(/\{[\s\S]*\}/)?.[0] || '{"decision":"CONTINUE"}');
        return decision;
    } catch {
        // Default to continue on parse error
        return { decision: 'CONTINUE', reasoning: 'Default continue' };
    }
}

/**
 * Generate final response from all step results
 */
async function generateFinalResponse(plan, stepResults, llmCall) {
    const stepsFormatted = stepResults.map((r, i) =>
        `Step ${i + 1} (${r.action}): ${JSON.stringify(r.result)}`
    ).join('\n');

    const prompt = formatPrompt(FINAL_ANSWER_PROMPT, {
        GOAL: plan.goal,
        STEP_RESULTS: stepsFormatted
    });

    try {
        const response = await llmCall(prompt, 'Generate a helpful response for the user.');
        return response;
    } catch (error) {
        return `I completed your request, but had trouble summarizing the results. Error: ${error.message}`;
    }
}

/**
 * Main executor function - runs the agent loop
 * 
 * @param {object} plan - Execution plan from planner
 * @param {object} options - Execution options
 * @param {object} options.tools - Tool registry { toolName: toolObject }
 * @param {function} options.llmCall - LLM call function
 * @param {object} options.context - Execution context (userId, etc.)
 * @param {function} options.onStep - Callback for each step (for SSE streaming)
 * @returns {Promise<object>} Execution result
 */
export async function executePlan(plan, options = {}) {
    const { tools = {}, llmCall, context = {}, onStep } = options;

    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const stepResults = [];

    // Log plan start
    logStep(runId, {
        type: 'plan',
        data: { goal: plan.goal, steps: plan.steps.map(s => s.action) }
    });

    if (onStep) {
        onStep({ type: 'planning', steps: plan.steps });
    }

    // Handle simple/direct response plans
    if (plan.isSimple || (plan.steps.length === 1 && plan.steps[0].action === 'respond')) {
        logStep(runId, { type: 'final', data: { simple: true } });
        return {
            runId,
            success: true,
            isSimple: true,
            response: null, // Let the chat handler generate response
            logs: getRunLogs(runId)
        };
    }

    let iteration = 0;
    let stepIndex = 0;

    while (stepIndex < plan.steps.length && iteration < MAX_ITERATIONS) {
        iteration++;
        const step = plan.steps[stepIndex];

        // Log step start
        logStep(runId, {
            type: 'tool_call',
            data: {
                stepIndex,
                action: step.action,
                description: step.description,
                params: step.params
            }
        });

        if (onStep) {
            onStep({
                type: 'step',
                index: stepIndex + 1,
                total: plan.steps.length,
                description: step.description
            });
        }

        // Execute tool
        const tool = tools[step.action];
        let result;

        if (!tool) {
            // Unknown tool - skip or error
            result = { error: `Unknown tool: ${step.action}`, skipped: true };
            logStep(runId, { type: 'error', data: { step: stepIndex, error: result.error } });
        } else {
            try {
                if (onStep) {
                    onStep({ type: 'tool_call', tool: step.action, params: step.params });
                }

                result = await executeToolWithTimeout(tool, step.params, context);

                logStep(runId, {
                    type: 'tool_result',
                    data: { step: stepIndex, tool: step.action, success: true, result }
                });

                if (onStep) {
                    onStep({ type: 'tool_result', tool: step.action, result, success: true });
                }

            } catch (error) {
                result = { error: error.message };
                logStep(runId, {
                    type: 'error',
                    data: { step: stepIndex, tool: step.action, error: error.message }
                });

                if (onStep) {
                    onStep({ type: 'tool_result', tool: step.action, result, success: false });
                }
            }
        }

        stepResults.push({ action: step.action, result });

        // Observe and decide (only if we have LLM and more steps remain)
        if (llmCall && stepIndex < plan.steps.length - 1) {
            const decision = await observeAndDecide(plan, stepIndex, result, llmCall);

            logStep(runId, {
                type: 'decision',
                data: { decision: decision.decision, reasoning: decision.reasoning }
            });

            if (decision.decision === 'COMPLETE') {
                break;
            } else if (decision.decision === 'ERROR') {
                logStep(runId, { type: 'error', data: { aborted: true, reason: decision.reasoning } });
                break;
            }
            // CONTINUE or MODIFY - proceed to next step
        }

        stepIndex++;
    }

    // Generate final response
    let finalResponse = null;
    if (llmCall && stepResults.length > 0) {
        finalResponse = await generateFinalResponse(plan, stepResults, llmCall);
    }

    logStep(runId, { type: 'final', data: { stepsCompleted: stepResults.length } });

    if (onStep) {
        onStep({ type: 'final', content: finalResponse });
    }

    return {
        runId,
        success: true,
        stepResults,
        response: finalResponse,
        logs: getRunLogs(runId)
    };
}

/**
 * Quick utility to run a single tool directly (for simple tool calls)
 */
export async function executeSingleTool(toolName, params, tools, context) {
    const tool = tools[toolName];
    if (!tool) {
        return { error: `Unknown tool: ${toolName}` };
    }

    try {
        return await executeToolWithTimeout(tool, params, context);
    } catch (error) {
        return { error: error.message };
    }
}
