/**
 * Table Session Management Utilities
 * Ensures tableId is preserved across the entire user flow
 */

const TABLE_ID_KEY = 'currentTableId';

/**
 * Get tableId from URL params or localStorage
 * @param {URLSearchParams} searchParams - URL search params from useSearchParams()
 * @returns {number|null} - Table ID or null if not found
 */
export const getTableId = (searchParams) => {
    // First, try to get from URL params
    const urlTableId = searchParams.get('table');

    if (urlTableId) {
        const tableId = Number(urlTableId);
        if (!isNaN(tableId) && tableId > 0) {
            // Save to localStorage for persistence
            localStorage.setItem(TABLE_ID_KEY, tableId.toString());
            return tableId;
        }
    }

    // If not in URL, try localStorage
    const storedTableId = localStorage.getItem(TABLE_ID_KEY);
    if (storedTableId) {
        const tableId = Number(storedTableId);
        if (!isNaN(tableId) && tableId > 0) {
            return tableId;
        }
    }

    // No valid tableId found
    return null;
};

/**
 * Clear stored tableId (useful for logout or session end)
 */
export const clearTableId = () => {
    localStorage.removeItem(TABLE_ID_KEY);
};

/**
 * Build navigation path with tableId
 * @param {string} path - Base path (e.g., '/menu', '/orders')
 * @param {number} tableId - Table ID
 * @returns {string} - Path with tableId query param
 */
export const buildTablePath = (path, tableId) => {
    if (!tableId) return path;
    return `${path}?table=${tableId}`;
};

/**
 * Check if tableId is valid and redirect if not
 * @param {number|null} tableId - Table ID to validate
 * @param {function} navigate - React Router navigate function
 * @returns {boolean} - True if valid, false if redirected
 */
export const validateTableId = (tableId, navigate) => {
    if (!tableId || isNaN(tableId) || tableId <= 0) {
        navigate('/invalid-table', { replace: true });
        return false;
    }
    return true;
};
