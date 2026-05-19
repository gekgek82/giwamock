"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import type { AdminRole, AdminAuthContext } from "@/types/admin";

// ============================================================================
// Constants
// ============================================================================

const ADMIN_STORAGE_KEY = "giwater_admin_auth";

// ============================================================================
// Context
// ============================================================================

const AdminAuthContextValue = createContext<AdminAuthContext | null>(null);

/**
 * Hook to access admin auth context
 */
export function useAdminAuth(): AdminAuthContext {
  const context = useContext(AdminAuthContextValue);
  if (!context) {
    throw new Error("useAdminAuth must be used within AdminAuthGuard");
  }
  return context;
}

// ============================================================================
// Props
// ============================================================================

interface AdminAuthGuardProps {
  children: ReactNode;
  /**
   * Required role level to access the content
   * - ADMIN: Full access
   * - OPERATOR: Read + some write access
   * - VIEWER: Read-only access
   */
  requiredRole?: AdminRole;
}

// ============================================================================
// Component
// ============================================================================

/**
 * AdminAuthGuard Component
 *
 * Protects admin pages with authentication.
 * Currently uses a simple password-based auth, but designed to be
 * easily upgraded to JWT-based authentication in the future.
 *
 * Usage:
 * ```tsx
 * <AdminAuthGuard requiredRole="ADMIN">
 *   <AdminPage />
 * </AdminAuthGuard>
 * ```
 */
export function AdminAuthGuard({ children, requiredRole = "VIEWER" }: AdminAuthGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Check saved authentication on mount
  useEffect(() => {
    const savedAuth = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (savedAuth) {
      try {
        const authData = JSON.parse(savedAuth);
        if (authData.authenticated === true) {
          setIsAuthenticated(true);
          setRole(authData.role || "ADMIN");
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      }
    } else {
      setIsAuthenticated(false);
    }
  }, []);

  // Login function for context
  const login = async (password: string): Promise<void> => {
    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) throw new Error("Invalid credentials");
    const { role: serverRole } = await res.json();
    const authData = { authenticated: true, role: serverRole as AdminRole };
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(authData));
    setIsAuthenticated(true);
    setRole(serverRole);
  };

  // Logout function for context
  const logout = () => {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    setIsAuthenticated(false);
    setRole(null);
  };

  // Handle password form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await login(password);
      setError("");
    } catch {
      setError("비밀번호가 올바르지 않습니다.");
    }
  };

  // Check role hierarchy
  const hasRequiredRole = (userRole: AdminRole | null, required: AdminRole): boolean => {
    if (!userRole) return false;
    const roleHierarchy: Record<AdminRole, number> = {
      ADMIN: 3,
      OPERATOR: 2,
      VIEWER: 1,
    };
    return roleHierarchy[userRole] >= roleHierarchy[required];
  };

  // Context value
  const contextValue: AdminAuthContext = {
    isAuthenticated: isAuthenticated || false,
    role,
    login,
    logout,
  };

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-1000">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-1000">
        <div className="bg-[#1a1a2e] p-8 rounded-2xl shadow-xl w-full max-w-md mx-4 border border-neutral-800">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary-700 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="4" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">GIWATER Admin</h1>
              <p className="text-sm text-neutral-500">관리자 로그인</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-2">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="관리자 비밀번호를 입력하세요"
                className="w-full px-4 py-3 bg-neutral-1000 border border-neutral-700 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-primary-700 transition-colors"
                autoFocus
              />
            </div>
            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}
            <button
              type="submit"
              className="w-full py-3 bg-primary-100 hover:bg-primary-200 text-neutral-1000 font-semibold rounded-xl transition-colors"
            >
              로그인
            </button>
          </form>

          <div className="mt-6 text-center">
            <a
              href="/"
              className="text-sm text-neutral-500 hover:text-primary-700 transition-colors"
            >
              ← 메인 페이지로 돌아가기
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Check if user has required role
  if (!hasRequiredRole(role, requiredRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-1000">
        <div className="bg-[#1a1a2e] p-8 rounded-2xl shadow-xl w-full max-w-md mx-4 border border-neutral-800 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">접근 권한 없음</h2>
          <p className="text-neutral-400 mb-6">
            이 페이지에 접근하려면 {requiredRole} 권한이 필요합니다.
          </p>
          <button
            onClick={logout}
            className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
          >
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  // Authenticated with required role - render children with context
  return (
    <AdminAuthContextValue.Provider value={contextValue}>
      {children}
    </AdminAuthContextValue.Provider>
  );
}
