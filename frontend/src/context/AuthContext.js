"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";

import { usePathname } from "next/navigation";

// Share authenticated account information across TuLinkUp.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const pathname = usePathname();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const requestId = useRef(0);

  // Retrieve the authenticated user's latest information.
  const refreshUser = useCallback(async () => {
    const id = ++requestId.current;

    setLoading(true);

    try {
      const response = await fetch("/api/auth/me", {
        cache: "no-store",
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error("Unable to verify account.");
      }

      const data = await response.json();

      if (id === requestId.current) {
        setUser(data.user ?? null);
      }
    } catch {
      if (id === requestId.current) {
        setUser(null);
      }
    } finally {
      if (id === requestId.current) {
        setLoading(false);
      }
    }
  }, []);

  // Clear account information after a successful logout.
  const clearUser = useCallback(() => {
    requestId.current += 1;
    setUser(null);
    setLoading(false);
  }, []);

  // Refresh account information when navigating.
  useEffect(() => {
    let cancelled = false;

    // Schedule the refresh outside the synchronous effect.
    queueMicrotask(() => {
      if (!cancelled) {
        void refreshUser();
      }
    });

    return () => {
      cancelled = true;
      requestId.current += 1;
    };
  }, [pathname, refreshUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        refreshUser,
        clearUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Access the shared authenticated account.
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider."
    );
  }

  return context;
}
