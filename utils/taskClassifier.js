/**
 * Task classification utility for auto model selection
 * Analyzes prompts to determine the best model for the task
 */

// Model definitions with capabilities
export const MODELS = {
    VISION_PRIMARY: 'gemini-2.5-flash',
    VISION_FALLBACK: 'llama3.2-vision:latest',
    REASONING: 'gemini-2.5-flash',
    FAST: 'gemini-2.5-flash',
};

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
export function classifyTask(prompt, hasImage = false) {
    const lowerPrompt = prompt.toLowerCase().trim();
    const wordCount = prompt.split(/\s+/).length;

    // Vision tasks take priority if image is attached
    if (hasImage) {
        return {
            taskType: 'vision',
            model: MODELS.VISION_PRIMARY,
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
                model: MODELS.FAST,
                reason: 'Casual greeting detected',
            };
        }

        // Short but not a greeting - could be a quick question
        return {
            taskType: 'quick_qa',
            model: MODELS.FAST,
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
            model: MODELS.REASONING,
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
            model: MODELS.REASONING,
            reason: 'Complex reasoning task detected',
        };
    }

    // Default to fast model for general Q&A
    return {
        taskType: 'general',
        model: MODELS.FAST,
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

