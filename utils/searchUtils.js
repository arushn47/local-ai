/**
 * Web Search Utilities using DuckDuckGo Instant Answer API
 * Free, no API key required
 */

/**
 * Search the web using DuckDuckGo
 * @param {string} query - Search query
 * @returns {Promise<object>} Search results
 */
export const searchWeb = async (query) => {
    try {
        // Use DuckDuckGo Instant Answer API (free, no key needed)
        const encodedQuery = encodeURIComponent(query);

        // Fetch from our API route to avoid CORS issues
        const response = await fetch(`/api/search?q=${encodedQuery}`);

        if (!response.ok) {
            throw new Error(`Search failed: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[Search] Error:', error);
        return { error: error.message };
    }
};

/**
 * Format search results for AI context
 * @param {object} results - Raw search results
 * @returns {string} Formatted string for AI
 */
export const formatSearchResults = (results) => {
    if (results.error) {
        return `[Search Error: ${results.error}]`;
    }

    let formatted = '[Web Search Results]\n\n';

    // Abstract/Summary
    if (results.Abstract) {
        formatted += `Summary: ${results.Abstract}\n`;
        if (results.AbstractURL) {
            formatted += `Source: ${results.AbstractURL}\n\n`;
        }
    }

    // Related topics
    if (results.RelatedTopics && results.RelatedTopics.length > 0) {
        formatted += 'Related Information:\n';
        for (const topic of results.RelatedTopics.slice(0, 5)) {
            if (topic.Text) {
                formatted += `- ${topic.Text}\n`;
            }
        }
    }

    // Infobox (for quick facts)
    if (results.Infobox?.content) {
        formatted += '\nQuick Facts:\n';
        for (const item of results.Infobox.content.slice(0, 5)) {
            if (item.label && item.value) {
                formatted += `- ${item.label}: ${item.value}\n`;
            }
        }
    }

    if (formatted === '[Web Search Results]\n\n') {
        return '[No search results found. Try a different query.]';
    }

    return formatted;
};
