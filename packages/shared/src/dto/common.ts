/**
 * Common DTO types shared across API modules
 */

export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
}

export interface SuccessResponse {
  success: boolean;
  message: string;
}
