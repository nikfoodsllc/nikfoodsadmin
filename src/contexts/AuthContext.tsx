'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthContextType, User, LoginResponse } from '@/types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'admin_token';
const USER_KEY = 'admin_user';
const EXPIRES_KEY = 'admin_expires_at';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    user: User | null;
    token: string | null;
    loading: boolean;
  }>({
    user: null,
    token: null,
    loading: true,
  });
  const router = useRouter();

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = () => {
      try {
        const storedToken = localStorage.getItem(TOKEN_KEY);
        const storedUser = localStorage.getItem(USER_KEY);
        const expiresAt = localStorage.getItem(EXPIRES_KEY);

        if (storedToken && storedUser && expiresAt) {
          const expiryTime = parseInt(expiresAt, 10);

          // Check if token is expired
          if (Date.now() < expiryTime) {
            setTimeout(() => {
              startTransition(() => {
                setState((prevState) => ({
                  ...prevState,
                  user: JSON.parse(storedUser),
                  token: storedToken,
                  loading: false,
                }));
              });
            }, 0);
          } else {
            // Token expired, clear storage
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            localStorage.removeItem(EXPIRES_KEY);
            setTimeout(() => {
              startTransition(() => {
                setState((prevState) => ({
                  ...prevState,
                  user: null,
                  token: null,
                  loading: false,
                }));
              });
            }, 0);
          }
        } else {
          setTimeout(() => {
            startTransition(() => {
              setState((prevState) => ({
                ...prevState,
                user: null,
                token: null,
                loading: false,
              }));
            });
          }, 0);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setTimeout(() => {
          startTransition(() => {
            setState((prevState) => ({
              ...prevState,
              user: null,
              token: null,
              loading: false,
            }));
          });
        }, 0);
      }
    };

    // Defer the initialization to avoid synchronous setState
    const timeoutId = setTimeout(initAuth, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      const loginData = data as LoginResponse;

      // Store auth data
      localStorage.setItem(TOKEN_KEY, loginData.token);
      localStorage.setItem(USER_KEY, JSON.stringify(loginData.user));
      localStorage.setItem(EXPIRES_KEY, loginData.expiresAt.toString());

      // Update state asynchronously
      setTimeout(() => {
        startTransition(() => {
          setState((prevState) => ({
            ...prevState,
            user: loginData.user,
            token: loginData.token,
            loading: false,
          }));
        });
      }, 0);

      // Redirect to admin dashboard
      router.push('/admin');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }, [router]);

  const logout = useCallback(() => {
    // Clear localStorage
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(EXPIRES_KEY);

    // Clear state
    setTimeout(() => {
      startTransition(() => {
        setState((prevState) => ({
          ...prevState,
          user: null,
          token: null,
          loading: false,
        }));
      });
    }, 0);

    // Redirect to login
    router.push('/login');
  }, [router]);

  const value: AuthContextType = {
    user: state.user,
    token: state.token,
    loading: state.loading,
    isAuthenticated: !!state.user && !!state.token,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
