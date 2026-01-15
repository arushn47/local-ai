/**
 * Agent API Endpoint - SSE streaming for agentic requests
 * 
 * Stable SSE Types (DO NOT CHANGE):
 * - planning: { steps: [...] }
 * - step: { index, total, description }
 * - tool_call: { tool, params }
 * - tool_result: { tool, result, success }
 * - final: { content }
 */

import { planGoal, detectRelevantTools } from '@/lib/agent/planner';
import { executePlan } from '@/lib/agent/executor';
import { TOOLS, getActiveTools, formatToolsForPrompt } from '@/lib/tools/registry';

// SSE Event Types - STABLE, DO NOT CHANGE
const SSE_TYPES = {
    PLANNING: 'planning',
    STEP: 'step',
    TOOL_CALL: 'tool_call',
    TOOL_RESULT: 'tool_result',
    FINAL: 'final',
    ERROR: 'error'
};

/**
 * Create SSE message
 */
function sseMessage(type, data) {
    return `data: ${JSON.stringify({ type, ...data })}\n\n`;
}

/**
 * Call Ollama LLM for agent reasoning
 */
async function callOllama(systemPrompt, userMessage, model = 'qwen2.5:7b-instruct') {
    try {
        const response = await fetch('http://127.0.0.1:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                stream: false
            })
        });

        const data = await response.json();
        return data.message?.content || '';
    } catch (error) {
        console.error('[Agent] Ollama call failed:', error);
        throw error;
    }
}

export async function POST(request) {
    const encoder = new TextEncoder();

    try {
        const body = await request.json();
        const { goal, chat_id, mode = 'agent' } = body;

        if (!goal) {
            return new Response(
                JSON.stringify({ error: 'Goal is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        console.log('[Agent API] Goal:', goal);

        // Create readable stream for SSE
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Context without Supabase - using Firebase now
                    // User auth is handled client-side with Firebase
                    const context = { userId: null, chatId: chat_id };

                    // LLM call wrapper
                    const llmCall = async (systemPrompt, userMessage) => {
                        return callOllama(systemPrompt, userMessage);
                    };

                    // Get relevant tools for this goal
                    const activeTools = getActiveTools(goal, 6);
                    console.log('[Agent API] Active tools:', activeTools.map(t => t.name));

                    // Step 1: Plan
                    const plan = await planGoal(goal, {
                        llmCall,
                        availableTools: activeTools
                    });

                    controller.enqueue(encoder.encode(
                        sseMessage(SSE_TYPES.PLANNING, {
                            steps: plan.steps,
                            complexity: plan.complexity
                        })
                    ));

                    // Step 2: Execute
                    const result = await executePlan(plan, {
                        tools: TOOLS,
                        llmCall,
                        context,
                        onStep: (stepData) => {
                            controller.enqueue(encoder.encode(
                                sseMessage(stepData.type, stepData)
                            ));
                        }
                    });

                    // Step 3: Final response
                    if (result.response) {
                        controller.enqueue(encoder.encode(
                            sseMessage(SSE_TYPES.FINAL, { content: result.response })
                        ));
                    }

                    // Done
                    controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
                    controller.close();

                } catch (error) {
                    console.error('[Agent API] Error:', error);
                    controller.enqueue(encoder.encode(
                        sseMessage(SSE_TYPES.ERROR, { error: error.message })
                    ));
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        });

    } catch (error) {
        console.error('[Agent API] Request error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
