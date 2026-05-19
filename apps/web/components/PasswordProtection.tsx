"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "giwater_auth";
const AUTH_TOKEN = "verified";

export function PasswordProtection({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    setIsAuthenticated(saved === AUTH_TOKEN);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("비밀번호가 올바르지 않습니다.");
        return;
      }
      localStorage.setItem(STORAGE_KEY, AUTH_TOKEN);
      setIsAuthenticated(true);
      setError("");
    } catch {
      setError("인증 요청에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // Show password form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="bg-[#1a1a2e] p-8 rounded-2xl shadow-xl w-full max-w-md mx-4">
          <h1 className="text-2xl font-bold text-white text-center mb-6">
            🔒 비밀번호 입력
          </h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                className="w-full px-4 py-3 bg-[#0d0d1a] border border-[#333] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#00d4ff] transition-colors"
                autoFocus
              />
            </div>
            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-gradient-to-r from-[#00d4ff] to-[#0099ff] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? "확인 중..." : "접속하기"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Authenticated - show children
  return <>{children}</>;
}
