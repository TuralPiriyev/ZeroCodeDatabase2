import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../utils/api';

interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  avatar?: string;
  color: string;
  isOnline: boolean;
  lastSeen: Date;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateUserProfile: (updates: Partial<User>) => Promise<void>;
  getCurrentUser: () => User | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Generate user color based on username
  const generateUserColor = (username: string): string => {
    const colors = [
      '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
      '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
    ];
    const hash = username.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  };

  // Check if user is already logged in
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const response = await api.get('/auth/me');
          if (response.data.user) {
            const userData = {
              ...response.data.user,
              color: generateUserColor(response.data.user.username),
              isOnline: true,
              lastSeen: new Date()
            };
            setUser(userData);
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('token');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await api.post('/auth/login', { email, password });
      
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        
        const userData = {
          ...response.data.user,
          color: generateUserColor(response.data.user.username),
          isOnline: true,
          lastSeen: new Date()
        };
        
        setUser(userData);
        
        // Update user online status
        await api.post('/users/online', { userId: userData.id });
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (username: string, email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await api.post('/auth/register', {
        username,
        email,
        password
      });
      
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        
        const userData = {
          ...response.data.user,
          color: generateUserColor(response.data.user.username),
          isOnline: true,
          lastSeen: new Date()
        };
        
        setUser(userData);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Registration failed:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (user) {
        // Update user offline status
        await api.post('/users/offline', { userId: user.id });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      setUser(null);
    }
  };

  const updateUserProfile = async (updates: Partial<User>): Promise<void> => {
    try {
      const response = await api.put('/api/users/profile', updates);
      if (response.data.user) {
        setUser(prev => prev ? { ...prev, ...response.data.user } : null);
      }
    } catch (error) {
      console.error('Profile update failed:', error);
      throw error;
    }
  };

  const getCurrentUser = (): User | null => {
    return user;
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
    updateUserProfile,
    getCurrentUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
