import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signInWithGoogle } from './firebase';

interface UserProfile {
  uid: string;
  displayName: string;
  role: 'admin' | 'user';
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (name: string, pass: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('jaeger_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = (name: string, pass: string) => {
    const lowerName = name.toLowerCase();
    const isMikey = lowerName === 'mikey';
    const isRonan = lowerName === 'ronan';
    
    if ((isMikey || isRonan) && pass === 'Jaeger004') {
      const profile: UserProfile = {
        uid: isMikey ? 'mikey_sector' : 'ronan_sector',
        displayName: isMikey ? 'Mikey' : 'Ronan',
        role: 'admin'
      };
      setUser(profile);
      localStorage.setItem('jaeger_user', JSON.stringify(profile));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('jaeger_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
