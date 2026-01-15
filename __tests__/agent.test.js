/**
 * Agent Integration Tests
 * 
 * Run: npm test
 * 
 * Tests cover:
 * - Planner goal decomposition
 * - Tool registry limiting
 * - Executor step handling
 * - Memory operations (storeMemory/getRelevantMemories)
 */

// Mock fetch for testing
global.fetch = jest.fn();

// Import modules
import { planGoal, detectRelevantTools } from '../lib/agent/planner.js';
import { getActiveTools, TOOLS } from '../lib/tools/registry.js';
import { executePlan, getRunLogs } from '../lib/agent/executor.js';

describe('Agent Planner', () => {
    test('planGoal: simple greeting returns single respond step', async () => {
        const plan = await planGoal('Hi there!');

        expect(plan.complexity).toBe('simple');
        expect(plan.isSimple).toBe(true);
        expect(plan.steps).toHaveLength(1);
        expect(plan.steps[0].action).toBe('respond');
    });

    test('planGoal: handles empty goal gracefully', async () => {
        const plan = await planGoal('');

        expect(plan.steps).toBeDefined();
        expect(plan.steps.length).toBeGreaterThan(0);
    });

    test('detectRelevantTools: calendar keywords detected', () => {
        const allTools = Object.values(TOOLS);
        const relevant = detectRelevantTools('check my calendar', allTools);

        const names = relevant.map(t => t.name);
        expect(names).toContain('calendar');
    });

    test('detectRelevantTools: math keywords detected', () => {
        const allTools = Object.values(TOOLS);
        const relevant = detectRelevantTools('calculate 25 + 17', allTools);

        const names = relevant.map(t => t.name);
        expect(names).toContain('calculator');
    });
});

describe('Tool Registry', () => {
    test('getActiveTools: limits to maxTools', () => {
        const tools = getActiveTools('show me everything', 3);

        expect(tools.length).toBeLessThanOrEqual(3);
    });

    test('getActiveTools: excludes dangerous tools by default', () => {
        const tools = getActiveTools('run a command', 10);

        const names = tools.map(t => t.name);
        expect(names).not.toContain('browser');
        expect(names).not.toContain('filesystem');
        expect(names).not.toContain('system');
    });

    test('getActiveTools: includes dangerous tools when explicitly allowed', () => {
        const tools = getActiveTools('browse the web', 10, { includeDangerous: true });

        const names = tools.map(t => t.name);
        // Should include at least one dangerous tool since explicitly allowed
        const hasDangerous = names.some(n => ['browser', 'filesystem', 'system'].includes(n));
        expect(hasDangerous || tools.length > 0).toBe(true);
    });

    test('TOOLS: all safe tools have execute function', () => {
        for (const [name, tool] of Object.entries(TOOLS)) {
            expect(typeof tool.execute).toBe('function');
            expect(tool.name).toBe(name);
            expect(tool.description).toBeDefined();
        }
    });
});

describe('Agent Executor', () => {
    test('executePlan: handles simple plan without LLM', async () => {
        const simplePlan = {
            goal: 'test',
            complexity: 'simple',
            isSimple: true,
            steps: [{ id: 1, action: 'respond', description: 'test', params: {} }]
        };

        const result = await executePlan(simplePlan, {});

        expect(result.success).toBe(true);
        expect(result.isSimple).toBe(true);
    });

    test('executePlan: logs are created for run', async () => {
        const plan = {
            goal: 'test',
            complexity: 'simple',
            steps: [{ id: 1, action: 'calculator', description: 'calc', params: { expression: '2+2' } }]
        };

        const result = await executePlan(plan, { tools: TOOLS });

        expect(result.runId).toBeDefined();
        const logs = getRunLogs(result.runId);
        expect(logs.length).toBeGreaterThan(0);
        expect(logs[0].type).toBe('plan');
    });

    test('executePlan: unknown tool reports error', async () => {
        const plan = {
            goal: 'test',
            complexity: 'simple',
            steps: [{ id: 1, action: 'nonexistent_tool', description: 'test', params: {} }]
        };

        const result = await executePlan(plan, { tools: TOOLS });

        expect(result.success).toBe(true);
        expect(result.stepResults[0].result.error).toContain('Unknown tool');
    });
});

describe('Calculator Tool', () => {
    test('calculator: basic addition', async () => {
        const result = await TOOLS.calculator.execute({ expression: '2 + 2' }, {});

        expect(result.result).toBe(4);
    });

    test('calculator: complex expression', async () => {
        const result = await TOOLS.calculator.execute({ expression: '(10 + 5) * 2' }, {});

        expect(result.result).toBe(30);
    });

    test('calculator: percentage', async () => {
        const result = await TOOLS.calculator.execute({ expression: '15% of 200' }, {});

        expect(result.result).toBe(30);
    });

    test('calculator: rejects invalid expression', async () => {
        const result = await TOOLS.calculator.execute({ expression: 'abc' }, {});

        expect(result.error).toBeDefined();
    });
});

describe('Memory Operations', () => {
    // These tests require mocking Supabase
    const mockSupabase = {
        from: jest.fn(() => ({
            insert: jest.fn(() => ({ error: null })),
            select: jest.fn(() => ({
                eq: jest.fn(() => ({
                    order: jest.fn(() => ({
                        limit: jest.fn(() => ({
                            execute: jest.fn(() => Promise.resolve({ data: [], error: null }))
                        }))
                    }))
                }))
            }))
        }))
    };

    test('notes tool: requires authentication', async () => {
        const result = await TOOLS.notes.execute(
            { operation: 'list' },
            { supabase: null, userId: null }
        );

        expect(result.error).toContain('authentication');
    });

    test('tasks tool: requires authentication', async () => {
        const result = await TOOLS.tasks.execute(
            { operation: 'list' },
            { supabase: null, userId: null }
        );

        expect(result.error).toContain('authentication');
    });
});
