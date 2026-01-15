'use client';

import React from 'react';
import { IconBrain, IconTool, IconCheck, IconLoader2, IconAlertCircle } from '@tabler/icons-react';

/**
 * Agent Step Visualizer - Shows agent thinking/execution steps
 * Bound to SSE events: planning, step, tool_call, tool_result, final
 */

const StepIcon = ({ type, status }) => {
    const iconClass = "w-4 h-4";

    if (status === 'running') {
        return <IconLoader2 className={`${iconClass} animate-spin text-blue-400`} />;
    }
    if (status === 'error') {
        return <IconAlertCircle className={`${iconClass} text-red-400`} />;
    }
    if (status === 'done') {
        return <IconCheck className={`${iconClass} text-green-400`} />;
    }

    switch (type) {
        case 'planning':
            return <IconBrain className={`${iconClass} text-purple-400`} />;
        case 'tool_call':
        case 'tool_result':
            return <IconTool className={`${iconClass} text-yellow-400`} />;
        default:
            return <div className={`${iconClass} rounded-full bg-white/20`} />;
    }
};

const StepItem = ({ step, isLast }) => {
    const { type, status, description, tool, result } = step;

    return (
        <div className="flex gap-3">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
                <div className="p-1.5 rounded-full bg-white/5 border border-white/10">
                    <StepIcon type={type} status={status} />
                </div>
                {!isLast && <div className="w-px flex-1 bg-white/10 my-1" />}
            </div>

            {/* Content */}
            <div className="flex-1 pb-4">
                <div className="text-sm font-medium text-white/90">
                    {type === 'planning' && 'Planning...'}
                    {type === 'step' && description}
                    {type === 'tool_call' && `Calling ${tool}...`}
                    {type === 'tool_result' && `${tool} completed`}
                    {type === 'final' && 'Generating response...'}
                </div>

                {/* Tool result preview */}
                {type === 'tool_result' && result && (
                    <div className="mt-1 text-xs text-white/50 bg-white/5 rounded px-2 py-1 font-mono overflow-hidden max-h-16">
                        {typeof result === 'string'
                            ? result.substring(0, 100)
                            : JSON.stringify(result).substring(0, 100)}
                        {(typeof result === 'string' ? result.length : JSON.stringify(result).length) > 100 && '...'}
                    </div>
                )}
            </div>
        </div>
    );
};

export default function AgentStepVisualizer({ steps = [], isThinking = false }) {
    if (!isThinking && steps.length === 0) {
        return null;
    }

    return (
        <div className="mx-4 my-2 p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-white/10">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
                <IconBrain className="w-5 h-5 text-purple-400" />
                <span className="text-sm font-semibold text-white/90">Agent Thinking</span>
                {isThinking && (
                    <span className="ml-auto flex items-center gap-1 text-xs text-blue-400">
                        <IconLoader2 className="w-3 h-3 animate-spin" />
                        Processing
                    </span>
                )}
            </div>

            {/* Steps timeline */}
            <div className="ml-1">
                {steps.map((step, index) => (
                    <StepItem
                        key={index}
                        step={step}
                        isLast={index === steps.length - 1}
                    />
                ))}

                {/* Show thinking indicator if still processing */}
                {isThinking && steps.length > 0 && steps[steps.length - 1].status !== 'running' && (
                    <div className="flex items-center gap-2 text-white/50 text-sm">
                        <IconLoader2 className="w-4 h-4 animate-spin" />
                        <span>Thinking...</span>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Agent Mode Toggle Button
 */
export function AgentModeToggle({ isEnabled, onToggle }) {
    return (
        <button
            onClick={onToggle}
            className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
                transition-all duration-200
                ${isEnabled
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'}
            `}
        >
            <IconBrain className="w-4 h-4" />
            <span>{isEnabled ? 'Agent Mode' : 'Chat Mode'}</span>
            {isEnabled && (
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            )}
        </button>
    );
}

/**
 * Hook to parse SSE events into steps
 */
export function useAgentSteps() {
    const [steps, setSteps] = React.useState([]);
    const [isThinking, setIsThinking] = React.useState(false);

    const reset = () => {
        setSteps([]);
        setIsThinking(false);
    };

    const handleSSEEvent = (event) => {
        const { type, ...data } = event;

        switch (type) {
            case 'planning':
                setIsThinking(true);
                setSteps([{
                    type: 'planning',
                    status: 'done',
                    description: `Planning ${data.steps?.length || 0} steps`,
                    steps: data.steps
                }]);
                break;

            case 'step':
                setSteps(prev => [...prev, {
                    type: 'step',
                    status: 'running',
                    description: data.description,
                    index: data.index,
                    total: data.total
                }]);
                break;

            case 'tool_call':
                setSteps(prev => {
                    const updated = [...prev];
                    // Update last step to show tool call
                    if (updated.length > 0) {
                        updated[updated.length - 1] = {
                            ...updated[updated.length - 1],
                            type: 'tool_call',
                            tool: data.tool,
                            params: data.params
                        };
                    }
                    return updated;
                });
                break;

            case 'tool_result':
                setSteps(prev => {
                    const updated = [...prev];
                    // Update last step with result
                    if (updated.length > 0) {
                        updated[updated.length - 1] = {
                            ...updated[updated.length - 1],
                            type: 'tool_result',
                            status: data.success ? 'done' : 'error',
                            result: data.result
                        };
                    }
                    return updated;
                });
                break;

            case 'final':
                setSteps(prev => [...prev, {
                    type: 'final',
                    status: 'done',
                    description: 'Response ready'
                }]);
                setIsThinking(false);
                break;

            case 'done':
                setIsThinking(false);
                break;

            case 'error':
                setSteps(prev => [...prev, {
                    type: 'error',
                    status: 'error',
                    description: data.error
                }]);
                setIsThinking(false);
                break;
        }
    };

    return { steps, isThinking, handleSSEEvent, reset };
}
