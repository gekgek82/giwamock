// Common types shared between frontend and backend

export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  uptime?: number;
  database?: 'connected' | 'disconnected';
}

export * from './banner';
export * from './pool';

