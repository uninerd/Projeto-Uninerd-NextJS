'use client';
import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import api from '../services/api';
import type { User, AuthContextData } from '../@types';
export const AuthContext = createContext<AuthContextData>({} as AuthContextData);
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api.get('/users/me').then(({ data }) => { if (active) setUser(data.data); })
      .catch(() => { if (active) setUser(null); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const signIn = useCallback(async (credentials: { email: string; password: string }) => {
    const { data } = await api.post('/users/login', { email: credentials.email, senha: credentials.password });
    setUser(data.user); return data.user as User;
  }, []);
  const signOut = useCallback(() => {
    api.post('/users/logout').then(() => { setUser(null); router.replace('/login'); })
      .catch(() => alert('Não foi possível encerrar a sessão. Tente novamente.'));
  }, [router]);
  return <AuthContext.Provider value={{ user, loading, signIn, signOut, updateUser: setUser }}>{children}</AuthContext.Provider>;
}
