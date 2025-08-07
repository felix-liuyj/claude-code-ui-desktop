import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../utils/api';

const AuthContext = createContext({
  user: null,
  token: null,
  login: () => {},
  register: () => {},
  logout: () => {},
  isLoading: true,
  needsSetup: false,
  error: null
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('auth-token'));
  const [isLoading, setIsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState(null);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      console.log('🔍 [AuthContext] Starting auth status check...');
      setIsLoading(true);
      setError(null);
      
      // Check if system needs setup
      console.log('🔍 [AuthContext] Checking auth status...');
      const statusResponse = await api.auth.status();
      const statusData = await statusResponse.json();
      console.log('✅ [AuthContext] Auth status response:', statusData);
      
      if (statusData.needsSetup) {
        console.log('🔧 [AuthContext] System needs setup');
        setNeedsSetup(true);
        setIsLoading(false);
        return;
      }
      
      // If we have a token, verify it
      if (token) {
        console.log('🔍 [AuthContext] Token found, verifying...');
        try {
          const userResponse = await api.auth.user();
          
          if (userResponse.ok) {
            const userData = await userResponse.json();
            console.log('✅ [AuthContext] Token valid, user:', userData.user);
            setUser(userData.user);
            setNeedsSetup(false);
          } else {
            // Token is invalid - clear it and continue to show login
            console.log('❌ [AuthContext] Token invalid, clearing auth state');
            localStorage.removeItem('auth-token');
            setToken(null);
            setUser(null);
            setNeedsSetup(false);
          }
        } catch (error) {
          // Network error or other issue - clear auth state and continue
          console.log('❌ [AuthContext] Token verification error:', error.message);
          localStorage.removeItem('auth-token');
          setToken(null);
          setUser(null);
          setNeedsSetup(false);
        }
      } else {
        // No token - user needs to login
        console.log('🔑 [AuthContext] No token found, user needs to login');
        setUser(null);
        setNeedsSetup(false);
      }
    } catch (error) {
      console.error('❌ [AuthContext] Auth status check failed:', error);
      // Don't show error to user for network issues - just clear auth state
      localStorage.removeItem('auth-token');
      setToken(null);
      setUser(null);
      setNeedsSetup(false);
      setError(null); // Clear any previous errors
    } finally {
      console.log('✅ [AuthContext] Auth check complete, isLoading = false');
      setIsLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      setError(null);
      const response = await api.auth.login(username, password);

      const data = await response.json();

      if (response.ok) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('auth-token', data.token);
        return { success: true };
      } else {
        setError(data.error || 'Login failed');
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = 'Network error. Please try again.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const register = async (username, password) => {
    try {
      setError(null);
      const response = await api.auth.register(username, password);

      const data = await response.json();

      if (response.ok) {
        setToken(data.token);
        setUser(data.user);
        setNeedsSetup(false);
        localStorage.setItem('auth-token', data.token);
        return { success: true };
      } else {
        setError(data.error || 'Registration failed');
        return { success: false, error: data.error || 'Registration failed' };
      }
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = 'Network error. Please try again.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('auth-token');
    
    // Optional: Call logout endpoint for logging
    if (token) {
      api.auth.logout().catch(error => {
        console.error('Logout endpoint error:', error);
      });
    }
  };

  const value = {
    user,
    token,
    login,
    register,
    logout,
    isLoading,
    needsSetup,
    error
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};