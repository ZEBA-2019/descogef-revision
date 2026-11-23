import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { get, post, setUnauthorizedHandler } from './api.js';
import { applyTheme } from './theme.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = chargement, null = déconnecté
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const { user } = await get('/auth/me');
      setUser(user);
      setError(null);
      if (user?.settings?.theme) applyTheme(user.settings.theme);
      return user;
    } catch (e) {
      setError(e);
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
    setUnauthorizedHandler(() => setUser(null));
  }, [refresh]);

  const value = useMemo(
    () => ({
      user,
      error,
      refresh,
      setUser,
      async login(email, password) {
        const { user } = await post('/auth/login', { email, password });
        setUser(user);
        if (user?.settings?.theme) applyTheme(user.settings.theme);
        return user;
      },
      async register(data) {
        const { user } = await post('/auth/register', data);
        setUser(user);
        return user;
      },
      async logout() {
        await post('/auth/logout').catch(() => {});
        setUser(null);
      },
    }),
    [user, error, refresh]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
