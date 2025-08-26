// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import { PortfolioProvider } from './context/PortfolioContext';

import UpgradeModal from './components/subscription/UpgradeModal';
import { ProtectedRoute } from './components/ProtectedRoute';

import { AuthPage } from './pages/AuthPage';
import { VerificationPage } from './components/auth/VerificationPage';
import { MainPage } from './pages/MainPage';
import { WorkspacePage } from './pages/WorkspacePage';

import { PayPalScriptProvider } from '@paypal/react-paypal-js';

function App() {
  return (
    <AuthProvider>
      <PayPalScriptProvider>
        <SubscriptionProvider>
          <PortfolioProvider>
            <BrowserRouter>
              <Routes>
                {/* Giriş nöqtəsi */}
                <Route path="/" element={<Navigate to="/main" replace />} />

                {/* Açıq routelar */}
                <Route path="/login" element={<AuthPage />} />
                <Route path="/verify" element={<VerificationPage />} />

                {/* Qorunan routelar */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/main" element={<MainPage />} />
                  <Route path="/workspace" element={<WorkspacePage />} />
                  <Route path="/workspace/:id" element={<WorkspacePage />} />
                </Route>

                {/* 404 */}
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
              <UpgradeModal />
            </BrowserRouter>
          </PortfolioProvider>
        </SubscriptionProvider>
      </PayPalScriptProvider>
    </AuthProvider>
  );
}

export default App;
