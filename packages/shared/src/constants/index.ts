export * from '../config/stable-quote-addresses';
export * from './contracts';
export * from './pair-indexer-display';
export * from './userMintableTokenBytecode';
export * from './tokenFaucetBytecode';

// API Routes - shared between frontend and backend
export const API_ROUTES = {
  HEALTH: '/api/health',
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    LOGOUT: '/api/auth/logout',
  },
  USERS: {
    BASE: '/api/users',
    BY_ID: (id: string) => `/api/users/${id}`,
  },
} as const;
