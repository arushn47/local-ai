/**
 * Tool Categories - Shared constants to avoid circular dependencies
 */
export const TOOL_CATEGORIES = {
    SAFE: 'safe',           // Can execute without confirmation
    SENSITIVE: 'sensitive', // Read access to user data (calendar, email)
    DANGEROUS: 'dangerous'  // Stubs only - require explicit confirmation
};
