// src/components/ProtectedRoute.tsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSubscription } from '../context/SubscriptionContext';

export const ProtectedRoute: React.FC = () => {
  const { loading } = useSubscription();
  const token = localStorage.getItem('token');

  // Hələ data gəlməyibsə, loading göstərici göstərə bilərsən
  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
        <p className="mt-4 text-blue-600">Loading...</p>
      </div>
    );
  }

  // Token yoxdursa, login-ə yönləndir
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Yoxdursa, qorunan routeları render et
  return <Outlet />;
};
