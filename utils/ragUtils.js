/**
 * RAG (Retrieval Augmented Generation) Utilities
 * Uses Ollama for embeddings and Supabase for vector storage
 */

// Chunk size for document splitting
const CHUNK_SIZE = 500; // characters
const CHUNK_OVERLAP = 50;

/**
 * Split text into overlapping chunks
 */
export const chunkText = (text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) => {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push({
            text: text.slice(start, end),
            start,
            end,
        });
        start += chunkSize - overlap;
    }

    return chunks;
};

/**
 * Generate embeddings using Ollama
 * Uses nomic-embed-text model (lightweight, good quality)
 */
export const generateEmbedding = async (text) => {
    try {
        const response = await fetch('http://127.0.0.1:11434/api/embeddings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'nomic-embed-text',
                prompt: text,
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to generate embedding');
        }

        const data = await response.json();
        return data.embedding;
    } catch (error) {
        console.error('[RAG] Embedding error:', error);
        return null;
    }
};

/**
 * Store document chunks with embeddings in Supabase
 */
export const storeDocument = async (supabase, userId, documentName, text) => {
    const chunks = chunkText(text);
    const storedChunks = [];

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await generateEmbedding(chunk.text);

        if (!embedding) {
            console.warn(`[RAG] Failed to embed chunk ${i}`);
            continue;
        }

        const { data, error } = await supabase
            .from('knowledge_chunks')
            .insert({
                user_id: userId,
                document_name: documentName,
                content: chunk.text,
                chunk_index: i,
                embedding: embedding,
            })
            .select()
            .single();

        if (error) {
            console.error('[RAG] Storage error:', error);
        } else {
            storedChunks.push(data);
        }
    }

    return storedChunks;
};

/**
 * Semantic search - find relevant chunks for a query
 */
export const semanticSearch = async (supabase, userId, query, limit = 5) => {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);

    if (!queryEmbedding) {
        return [];
    }

    // Use Supabase's vector similarity search
    // This requires the pgvector extension and a similarity function
    const { data, error } = await supabase
        .rpc('match_knowledge_chunks', {
            query_embedding: queryEmbedding,
            match_count: limit,
            user_id_filter: userId,
        });

    if (error) {
        console.error('[RAG] Search error:', error);
        return [];
    }

    return data || [];
};

/**
 * Format search results for AI context
 */
export const formatRAGContext = (results) => {
    if (!results || results.length === 0) {
        return '';
    }

    let context = '[Knowledge Base Context]\n\n';

    for (const result of results) {
        context += `From "${result.document_name}":\n`;
        context += `${result.content}\n\n`;
    }

    return context;
};

/**
 * Delete all chunks for a document
 */
export const deleteDocument = async (supabase, userId, documentName) => {
    const { error } = await supabase
        .from('knowledge_chunks')
        .delete()
        .eq('user_id', userId)
        .eq('document_name', documentName);

    return !error;
};

/**
 * List all documents for a user
 */
export const listDocuments = async (supabase, userId) => {
    const { data, error } = await supabase
        .from('knowledge_chunks')
        .select('document_name')
        .eq('user_id', userId);

    if (error) return [];

    // Get unique document names
    const uniqueDocs = [...new Set(data.map(d => d.document_name))];
    return uniqueDocs;
};

// ============================================================
// SEMANTIC MEMORY SYSTEM
// Stores different types of memories for agent context
// ============================================================

/**
 * Memory types for categorization
 */
export const MEMORY_TYPES = {
    PREFERENCE: 'preference',  // "User prefers morning meetings"
    FACT: 'fact',             // "User's name is Arush"
    LESSON: 'lesson',         // "Last time calendar API failed due to auth"
    CONTEXT: 'context'        // General conversation context
};

/**
 * Store a memory with type and importance
 * Uses the existing memories table with memory_type column
 * 
 * @param {object} supabase - Supabase client
 * @param {string} userId - User ID
 * @param {string} content - Memory content
 * @param {string} memoryType - One of MEMORY_TYPES
 * @param {number} importance - 1-5 scale (5 = most important)
 * @returns {Promise<object>} Stored memory or error
 */
export const storeMemory = async (supabase, userId, content, memoryType = MEMORY_TYPES.CONTEXT, importance = 1) => {
    if (!supabase || !userId || !content) {
        return { error: 'Missing required parameters' };
    }

    try {
        // Generate embedding for semantic search
        const embedding = await generateEmbedding(content);

        const { data, error } = await supabase
            .from('memories')
            .insert({
                user_id: userId,
                content: content,
                memory_type: memoryType,
                importance: Math.min(5, Math.max(1, importance)),
                embedding: embedding
            })
            .select()
            .single();

        if (error) {
            console.error('[Memory] Store error:', error);
            return { error: error.message };
        }

        console.log(`[Memory] Stored ${memoryType}: "${content.substring(0, 50)}..."`);
        return { success: true, memory: data };

    } catch (error) {
        console.error('[Memory] Store error:', error);
        return { error: error.message };
    }
};

/**
 * Get relevant memories for a query using semantic search
 * Prioritizes by relevance and importance
 * 
 * @param {object} supabase - Supabase client
 * @param {string} userId - User ID
 * @param {string} query - Search query
 * @param {number} limit - Max memories to return
 * @param {array} types - Filter by memory types (optional)
 * @returns {Promise<array>} Relevant memories
 */
export const getRelevantMemories = async (supabase, userId, query, limit = 5, types = null) => {
    if (!supabase || !userId) {
        return [];
    }

    try {
        // Generate query embedding
        const queryEmbedding = await generateEmbedding(query);

        if (!queryEmbedding) {
            // Fallback: get recent memories without semantic search
            let queryBuilder = supabase
                .from('memories')
                .select('*')
                .eq('user_id', userId)
                .order('importance', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(limit);

            if (types && types.length > 0) {
                queryBuilder = queryBuilder.in('memory_type', types);
            }

            const { data, error } = await queryBuilder;

            if (error) {
                console.error('[Memory] Fallback fetch error:', error);
                return [];
            }

            return data || [];
        }

        // Use vector similarity search if embedding available
        // This requires a match_memories RPC function in Supabase
        const { data, error } = await supabase
            .rpc('match_memories', {
                query_embedding: queryEmbedding,
                match_count: limit,
                user_id_filter: userId,
                type_filter: types
            });

        if (error) {
            // RPC might not exist, fallback to standard query
            console.warn('[Memory] Vector search unavailable, using fallback');

            let queryBuilder = supabase
                .from('memories')
                .select('*')
                .eq('user_id', userId)
                .order('importance', { ascending: false })
                .limit(limit);

            if (types && types.length > 0) {
                queryBuilder = queryBuilder.in('memory_type', types);
            }

            const { data: fallbackData } = await queryBuilder;
            return fallbackData || [];
        }

        return data || [];

    } catch (error) {
        console.error('[Memory] Get relevant error:', error);
        return [];
    }
};

/**
 * Format memories for injection into agent context
 */
export const formatMemoriesForContext = (memories) => {
    if (!memories || memories.length === 0) {
        return '';
    }

    let context = '[User Memory Context]\n\n';

    // Group by type
    const grouped = {};
    for (const mem of memories) {
        const type = mem.memory_type || MEMORY_TYPES.CONTEXT;
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(mem);
    }

    // Format each group
    for (const [type, mems] of Object.entries(grouped)) {
        context += `${type.toUpperCase()}:\n`;
        for (const mem of mems) {
            context += `- ${mem.content}\n`;
        }
        context += '\n';
    }

    return context;
};

/**
 * Auto-detect memory type from content
 */
export const detectMemoryType = (content) => {
    const lower = content.toLowerCase();

    if (lower.includes('prefer') || lower.includes('like') || lower.includes('want') || lower.includes('favorite')) {
        return MEMORY_TYPES.PREFERENCE;
    }
    if (lower.includes('my name is') || lower.includes('i am') || lower.includes('i work') || lower.includes('i live')) {
        return MEMORY_TYPES.FACT;
    }
    if (lower.includes('learned') || lower.includes('remember') || lower.includes('note') || lower.includes('failed')) {
        return MEMORY_TYPES.LESSON;
    }

    return MEMORY_TYPES.CONTEXT;
};
