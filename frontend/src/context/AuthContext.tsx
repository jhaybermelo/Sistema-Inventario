import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '../types';
import { getMe } from '../api/auth';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      getMe()
        .then(setUser)
        .catch(() => {
          localStorage.removeItem('token');
          setToken(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = async (newToken: string) => {
    const pendingCart = localStorage.getItem('pos_cart_pending');
    const pendingPayment = localStorage.getItem('pos_payment_method_pending');
    localStorage.setItem('token', newToken);
    if (pendingCart) {
      localStorage.setItem('pos_cart', pendingCart);
      localStorage.removeItem('pos_cart_pending');
    }
    if (pendingPayment) {
      localStorage.setItem('pos_payment_method', pendingPayment);
      localStorage.removeItem('pos_payment_method_pending');
    }
    setToken(newToken);
    const me = await getMe();
    setUser(me);
  };

  const logout = () => {
    const cart = localStorage.getItem('pos_cart');
    const payment = localStorage.getItem('pos_payment_method');
    localStorage.clear();
    if (cart) localStorage.setItem('pos_cart_pending', cart);
    if (payment) localStorage.setItem('pos_payment_method_pending', payment);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
