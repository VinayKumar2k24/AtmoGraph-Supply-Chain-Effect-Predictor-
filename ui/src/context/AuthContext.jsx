import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchCurrentUser, loginUser, signupUser, logoutUser } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('atmograph_token'));
  const [loading, setLoading] = useState(true);

  // Validate active session on mount
  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        const data = await fetchCurrentUser();
        if (isMounted && data?.authenticated && data?.user) {
          setUser(data.user);
        } else if (isMounted) {
          setUser(null);
        }
      } catch {
        if (isMounted) {
          // If a token was saved previously, check if offline fallback applies
          const savedToken = localStorage.getItem('atmograph_token');
          const savedUser = localStorage.getItem('atmograph_user');
          if (savedToken && savedUser) {
            try {
              setUser(JSON.parse(savedUser));
            } catch {
              setUser(null);
            }
          } else {
            setUser(null);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (email, password, rememberMe = false) => {
    try {
      const res = await loginUser({ email, password, remember_me: rememberMe });
      if (res && res.user) {
        setUser(res.user);
        if (res.access_token) {
          setToken(res.access_token);
          localStorage.setItem('atmograph_token', res.access_token);
        }
        localStorage.setItem('atmograph_user', JSON.stringify(res.user));
        return { success: true, user: res.user };
      }
      throw new Error(res?.message || 'Authentication failed');
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const signup = useCallback(async (formData) => {
    try {
      const res = await signupUser(formData);
      if (res && res.user) {
        setUser(res.user);
        if (res.access_token) {
          setToken(res.access_token);
          localStorage.setItem('atmograph_token', res.access_token);
        }
        localStorage.setItem('atmograph_user', JSON.stringify(res.user));
        return { success: true, user: res.user };
      }
      throw new Error(res?.message || 'Registration failed');
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } catch {
      // Ignore network errors on logout
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('atmograph_token');
      localStorage.removeItem('atmograph_user');
    }
  }, []);

  const demoLogin = useCallback(async () => {
    return login('demo@atmograph.ai', 'Password123!', false);
  }, [login]);

  const value = {
    user,
    token,
    isAuthenticated: !!user,
    loading,
    login,
    signup,
    logout,
    demoLogin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
