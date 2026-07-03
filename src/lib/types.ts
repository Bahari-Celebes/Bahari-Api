// --- App Environment Types ---
export type AppEnv = {
  Variables: {
    user: JwtPayload;
  };
};

// --- User Roles (BAHARI Intelligence) ---
export type UserRole = "admin" | "cooperative_manager" | "operator" | "reviewer";

// --- JWT Payload ---
export type JwtPayload = {
  userId: string;
  role: UserRole;
  cooperativeId?: string;
};

// --- API Response Types ---
export type ApiResponse<T> = {
  success: true;
  data: T;
};

export type ApiErrorResponse = {
  success: false;
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
};

export type PaginatedResponse<T> = {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

// --- Pagination Params ---
export type PaginationParams = {
  page: number;
  limit: number;
};
