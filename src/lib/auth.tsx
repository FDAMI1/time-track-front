import { createContext, useContext, useState, useEffect, useCallback } from "react";

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
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (credential: string, password: string, isEmail?: boolean) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
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
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        if (userData.mustChangePassword) {
          setMustChangePassword(true);
        }
      } else {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
      }
    } catch {
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
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

  const login = async (credential: string, password: string, isEmail?: boolean) => {
    const body = isEmail
      ? { email: credential, password }
      : { username: credential, password };
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "Login failed");
    }

    const data = await res.json();
    localStorage.setItem("token", data.token);
    setToken(data.token);
    setUser(data.user);
    if (data.mustChangePassword) {
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
    window.history.replaceState(null, "", "/");
  };

  const clearMustChangePassword = () => {
    setMustChangePassword(false);
  };

  const impersonate = async (userId: string) => {
    if (!token) return;
    const res = await fetch(`/api/auth/impersonate/${userId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "Impersonation failed");
    }

    const data = await res.json();
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
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, isLoading, mustChangePassword, clearMustChangePassword, isImpersonating, impersonate, exitImpersonation, impersonatedOrgName }}>
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
