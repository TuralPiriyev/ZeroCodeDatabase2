import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';
import { Database } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const { isAuthenticated, isLoading } = useAuth();

  const toggleForm = () => {
    setIsLogin(!isLogin);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-blue-50">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/main" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-100 to-blue-50 p-4">
      <div className="relative w-full max-w-md">
        <motion.div
          className="overflow-hidden rounded-2xl bg-white shadow-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="relative h-32 bg-blue-400 p-6 pb-0">
            <div className="flex items-center">
              <Database className="mr-3 text-white" size={32} />
              <h1 className="text-2xl font-bold text-white">Database Designer</h1>
            </div>

            <div className="absolute left-6 right-6 -bottom-6 rounded-lg bg-white px-4 py-3 shadow-md">
              <div className="flex justify-around border-b border-gray-100">
                <button
                  className={`relative py-2 font-medium transition-colors ${
                    isLogin ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setIsLogin(true)}
                >
                  Sign In
                  {isLogin && (
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                      layoutId="activeTab"
                    />
                  )}
                </button>
                <button
                  className={`relative py-2 font-medium transition-colors ${
                    !isLogin ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setIsLogin(false)}
                >
                  Register
                  {!isLogin && (
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                      layoutId="activeTab"
                    />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="p-6 pt-14">
            <AnimatePresence mode="wait">
              <motion.div
                key={isLogin ? 'login' : 'register'}
                initial={{ opacity: 0, x: isLogin ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isLogin ? 20 : -20 }}
                transition={{ duration: 0.3 }}
              >
                {isLogin ? (
                  <LoginForm onRegisterClick={toggleForm} />
                ) : (
                  <RegisterForm onLoginClick={toggleForm} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
};