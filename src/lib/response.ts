import type { ApiResponse, PaginatedResponse, PaginationParams } from "./types";

/**
 * Create a successful API response
 */
export function success<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

/**
 * Create a paginated API response
 */
export function paginated<T>(
  data: T[],
  pagination: PaginationParams & { total: number }
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
    },
  };
}

/**
 * Parse pagination query params with defaults
 */
export function parsePagination(query: Record<string, string | undefined>): PaginationParams {
  const page = Math.max(1, parseInt(query.page || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || "10", 10)));
  return { page, limit };
}

/**
 * Calculate offset for SQL queries
 */
export function getOffset(params: PaginationParams): number {
  return (params.page - 1) * params.limit;
}
