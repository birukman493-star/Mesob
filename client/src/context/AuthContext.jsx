import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem("mesob_token")));

  async function refresh() {
    if (!localStorage.getItem("mesob_token")) {
      setMe(null);
      setLoading(false);
      return null;
    }
    const { data } = await api.get("/me");
    setMe(data);
    setLoading(false);
    return data;
  }

  useEffect(() => {
    refresh().catch(() => {
      localStorage.removeItem("mesob_token");
      setMe(null);
      setLoading(false);
    });
  }, []);

  async function startSession(token) {
    localStorage.setItem("mesob_token", token);
    return refresh();
  }

  async function register(body) {
    const { data } = await api.post("/auth/register", body);
    return startSession(data.token);
  }

  async function login(body) {
    const { data } = await api.post("/auth/login", body);
    return startSession(data.token);
  }

  function logout() {
    localStorage.removeItem("mesob_token");
    setMe(null);
  }

  return (
    <AuthContext.Provider value={{ me, loading, register, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function homeFor(data) {
  const role = data?.user?.role;
  if (role === "admin") return "/admin";
  if (role === "dietitian") return "/dietitian";
  if (!data?.user?.category) return "/category";
  if (!data?.profile_complete) return "/profile";
  return "/dashboard";
}
