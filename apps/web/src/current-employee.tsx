import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken, type Me } from './api';

// Auth: zalogowany pracownik z tokenu JWT (FR-H5). Zastępuje wcześniejszy stand-in selektora.
interface AuthCtx {
  current: Me | undefined;
  ready: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => void;
}
const AuthContext = createContext<AuthCtx | null>(null);

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth poza AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Me>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      setReady(true);
      return;
    }
    api.me()
      .then((m) => setCurrent(m ?? undefined))
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  const login = async (l: string, p: string) => {
    await api.login(l, p);
    const m = await api.me();
    setCurrent(m ?? undefined);
  };
  const logout = () => {
    setToken(null);
    setCurrent(undefined);
  };

  return <AuthContext.Provider value={{ current, ready, login, logout }}>{children}</AuthContext.Provider>;
}
