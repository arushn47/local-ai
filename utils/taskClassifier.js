/**
 * Task classification utility for auto model selection
 * Analyzes prompts to determine the best model for the task
 */

// Model definitions with capabilities
// NOTE: "online" here means Gemini (cloud). "offline" means local Ollama models.
export const MODELS = {
    offline: {
        VISION_PRIMARY: 'qwen3-vl:8b',
        VISION_FALLBACK: 'llama3.2-vision:latest',
        REASONING: 'deepseek-r1:8b',
        FAST: 'qwen2.5:7b-instruct',
    },
    online: {
        VISION_PRIMARY: 'gemini-2.5-flash',
        VISION_FALLBACK: 'gemini-2.5-flash',
        REASONING: 'gemini-2.5-flash',
        FAST: 'gemini-2.5-flash',
    },
};

function getModelMode() {
    const raw = (process.env.NEXT_PUBLIC_MODEL_MODE || '').toLowerCase().trim();
    if (raw === 'online' || raw === 'offline') return raw;
    // Default to offline mapping; server-side fallback can still route to Gemini.
    return 'offline';
}

// Keywords for task detection
const CODING_KEYWORDS = [
    'code', 'function', 'class', 'variable', 'debug', 'error', 'bug', 'fix',
    'python', 'javascript', 'typescript', 'react', 'node', 'api', 'database',
    'sql', 'html', 'css', 'json', 'xml', 'algorithm', 'data structure',
    'implement', 'refactor', 'optimize', 'compile', 'runtime', 'syntax',
    'git', 'deploy', 'server', 'backend', 'frontend', 'framework',
];

const REASONING_KEYWORDS = [
    'explain', 'analyze', 'compare', 'contrast', 'evaluate', 'assess',
    'why', 'how does', 'what if', 'consider', 'think about', 'reason',
    'pros and cons', 'advantages', 'disadvantages', 'implications',
    'step by step', 'walk me through', 'break down', 'elaborate',
    'deep dive', 'in detail', 'comprehensive', 'thorough',
];

const CASUAL_GREETINGS = [
    'hi', 'hello', 'hey', 'sup', 'yo', 'good morning', 'good evening',
    'good afternoon', 'what\'s up', 'how are you', 'howdy', 'greetings',
];

/**
 * Classify the task type based on prompt content and context
 * @param {string} prompt - The user's message
 * @param {boolean} hasImage - Whether an image is attached
 * @returns {{ taskType: string, model: string, reason: string }}
 */
export function classifyTask(prompt, hasImage = false, options = {}) {
    const mode = options?.mode || getModelMode();
    const profile = MODELS[mode] || MODELS.offline;
    const lowerPrompt = prompt.toLowerCase().trim();
    const wordCount = prompt.split(/\s+/).length;

    // Vision tasks take priority if image is attached
    if (hasImage) {
        return {
            taskType: 'vision',
            model: profile.VISION_PRIMARY,
            reason: 'Image attached - using vision model',
        };
    }

    // Very short messages (likely casual chat)
    if (wordCount <= 5) {
        // Check for greetings
        const isGreeting = CASUAL_GREETINGS.some(greeting =>
            lowerPrompt.includes(greeting) || lowerPrompt === greeting
        );

        if (isGreeting) {
            return {
                taskType: 'casual',
                model: profile.FAST,
                reason: 'Casual greeting detected',
            };
        }

        // Short but not a greeting - could be a quick question
        return {
            taskType: 'quick_qa',
            model: profile.FAST,
            reason: 'Short prompt - using fast model',
        };
    }

    // Check for code indicators
    const hasCodeBlock = /```[\s\S]*```/.test(prompt) || /`[^`]+`/.test(prompt);
    const hasCodingKeywords = CODING_KEYWORDS.some(keyword =>
        lowerPrompt.includes(keyword.toLowerCase())
    );

    if (hasCodeBlock || hasCodingKeywords) {
        return {
            taskType: 'coding',
            model: profile.REASONING,
            reason: 'Coding/technical task detected',
        };
    }

    // Check for complex reasoning indicators
    const hasReasoningKeywords = REASONING_KEYWORDS.some(keyword =>
        lowerPrompt.includes(keyword.toLowerCase())
    );

    // Long prompts (> 50 words) or reasoning keywords suggest complex task
    if (wordCount > 50 || hasReasoningKeywords) {
        return {
            taskType: 'reasoning',
            model: profile.REASONING,
            reason: 'Complex reasoning task detected',
        };
    }

    // Default to fast model for general Q&A
    return {
        taskType: 'general',
        model: profile.FAST,
        reason: 'General query - using fast model',
    };
}

/**
 * Get display-friendly model label
 * @param {string} modelValue - The model identifier
 * @returns {string} - Human readable label
 */
export function getModelLabel(modelValue) {
    const labels = {
        'gemini-3-pro': 'Gemini 3 Pro',
        'gemini-2.5-flash': 'Gemini 2.5 Flash',
        'gemini-1.5-flash': 'Gemini 1.5 Flash',
        'gemini-1.5-pro': 'Gemini 1.5 Pro',
        'llama3.2-vision:latest': 'Llama Vision 3.2',
        'qwen3-vl:8b': 'Qwen 3 VL',
        'qwen2.5:7b-instruct': 'Qwen 2.5',
        'deepseek-r1:8b': 'Deepseek R1',
        'llava:latest': 'Llava',
        'bakllava:latest': 'BakLlava',
        'deepseek-r1:latest': 'Deepseek R1',
    };
    return labels[modelValue] || modelValue;
}

