import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { api } from "./api";

interface AuthUser {
  userId: number;
  username: string;
  fullName: string;
  role: "ADMIN" | "ACCOUNTING";
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<AuthUser>("/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const data = await api.post<AuthUser>("/auth/login", { username, password });
    setUser(data);
  };

  const logout = async () => {
    await api.post("/auth/logout", {});
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, isAdmin: user?.role === "ADMIN" }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
