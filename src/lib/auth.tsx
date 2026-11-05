import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiFetch, postJson, safeJson } from "./api";
import { queryClient } from "./queryClient";

// Dev-only logging so auth details (roles, impersonation targets) never reach
// production consoles.
const debug = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log(...args);
};

interface User {
  _id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId?: any;
  isActive: boolean;
  mustChangePassword?: boolean;
  locationRestrictionEnabled?: boolean | null;
  toolAccess?: { tickets?: boolean; crm?: boolean };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (credential: string, password: string, isEmail?: boolean, extras?: Record<string, number>) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  // Adopts a replacement token (issued after a password change, which ends
  // every other session) without logging the user out.
  replaceToken: (newToken: string) => void;
  isLoading: boolean;
  mustChangePassword: boolean;
  clearMustChangePassword: () => void;
  isImpersonating: boolean;
  impersonate: (userId: string) => Promise<void>;
  exitImpersonation: () => void;
  impersonatedOrgName: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [isLoading, setIsLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(() => !!localStorage.getItem("superadminToken"));
  const [impersonatedOrgName, setImpersonatedOrgName] = useState<string | null>(() => localStorage.getItem("impersonatedOrgName"));

  const fetchUser = useCallback(async (authToken: string) => {
    try {
      debug("[auth] fetchUser →", "/api/auth/me");
      const res = await apiFetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      debug("[auth] fetchUser status:", res.status);
      if (res.ok) {
        const userData = await safeJson<User>(res);
        setUser(userData);
        if (userData.mustChangePassword) {
          setMustChangePassword(true);
        }
      } else if (res.status === 401 || res.status === 403) {
        // The server rejected this token: the session is over.
        debug("[auth] token rejected — clearing session");
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
      } else {
        // A server hiccup (5xx) must not sign the user out.
        console.error("[auth] fetchUser unexpected status:", res.status);
      }
    } catch (err) {
      // Offline or unreachable: keep the stored token so the app recovers on reconnect.
      console.error("[auth] fetchUser error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchUser(token);
    } else {
      setIsLoading(false);
    }
  }, [token, fetchUser]);

  const login = async (credential: string, password: string, isEmail?: boolean, extras?: Record<string, number>) => {
    const body = isEmail
      ? { email: credential, password, ...extras }
      : { username: credential, password, ...extras };

    debug("[auth] login → POST /api/auth/login");

    let data: any;
    try {
      data = await postJson("/api/auth/login", body);
    } catch (err: any) {
      console.error("[auth] login failed:", err);
      throw new Error(err.message || "Login failed");
    }

    debug("[auth] login response:", { token: !!data.token, role: data.user?.role });

    if (!data.token) {
      throw new Error(data.message || "Login failed");
    }

    localStorage.setItem("token", data.token);
    queryClient.clear();
    setToken(data.token);
    setUser(data.user);
    if (data.user.mustChangePassword) {
      setMustChangePassword(true);
    } else {
      window.history.replaceState(null, "", "/");
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("superadminToken");
    localStorage.removeItem("impersonatedOrgName");
    localStorage.removeItem("app_theme");
    setToken(null);
    setUser(null);
    setMustChangePassword(false);
    setIsImpersonating(false);
    setImpersonatedOrgName(null);
    // Cached responses belong to this user, so the next one in this browser must not see them.
    queryClient.clear();
    window.history.replaceState(null, "", "/");
  };

  const replaceToken = useCallback((newToken: string) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
  }, []);

  const clearMustChangePassword = () => {
    setMustChangePassword(false);
  };

  const impersonate = async (userId: string) => {
    if (!token) return;
    debug("[auth] impersonate →", userId);
    let res: Response;
    try {
      res = await apiFetch(`/api/auth/impersonate/${userId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error("[auth] impersonate network error:", err);
      throw new Error("Network error during impersonation");
    }
    const data = await safeJson(res);
    if (!res.ok) {
      throw new Error(data.message || "Impersonation failed");
    }
    const orgName = data.user?.organizationId?.name || "Organization";
    localStorage.setItem("superadminToken", token);
    localStorage.setItem("impersonatedOrgName", orgName);
    localStorage.setItem("token", data.token);
    setIsImpersonating(true);
    setImpersonatedOrgName(orgName);
    setToken(data.token);
    setUser(data.user);
    window.history.replaceState(null, "", "/");
  };

  const exitImpersonation = () => {
    const savedToken = localStorage.getItem("superadminToken");
    if (savedToken) {
      localStorage.setItem("token", savedToken);
      localStorage.removeItem("superadminToken");
      localStorage.removeItem("impersonatedOrgName");
      window.location.href = "/organizations";
    }
  };

  const refreshUser = useCallback(async () => {
    if (token) await fetchUser(token);
  }, [token, fetchUser]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, replaceToken, isLoading, mustChangePassword, clearMustChangePassword, isImpersonating, impersonate, exitImpersonation, impersonatedOrgName }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function authFetch(token: string | null) {
  return (url: string, options: RequestInit = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  };
}
