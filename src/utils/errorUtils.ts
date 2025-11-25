/**
 * Utility functions for error handling
 * Reduces code duplication across the codebase
 */

/**
 * Extract error message from unknown error type
 * @param error The error to extract message from
 * @returns Error message string
 */
export function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

