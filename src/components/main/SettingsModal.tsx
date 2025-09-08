import React, { useState, useEffect } from 'react';
import { X, User, Mail, Crown, Loader, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

interface UserSettings {
  username: string;
  email: string;
  subscriptionPlan: string;
  expiresAt?: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchUserSettings();
    }
  }, [isOpen]);

  const fetchUserSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/users/me');
      setUserSettings({
        username: response.data.username || 'N/A',
        email: response.data.email || 'N/A',
        subscriptionPlan: response.data.subscriptionPlan || 'Free',
        expiresAt: response.data.expiresAt
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch user settings');
    } finally {
      setLoading(false);
    }
  };

  const getPlanBadgeColor = (plan: string) => {
    switch (plan.toLowerCase()) {
      case 'pro':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ultimate':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPlanIcon = (plan: string) => {
    switch (plan.toLowerCase()) {
      case 'pro':
      case 'ultimate':
        return <Crown className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out?')) {
      try {
        await logout();
        navigate('/login');
        onClose();
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Account Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading settings...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-800">
                <X className="w-4 h-4" />
                <span className="font-medium">Error</span>
              </div>
              <p className="text-red-700 text-sm mt-1">{error}</p>
              <button
                onClick={fetchUserSettings}
                className="mt-3 text-sm bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition-colors duration-200"
              >
                Retry
              </button>
            </div>
          ) : userSettings ? (
            <div className="space-y-6">
              {/* Username */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">Username</h3>
                  <p className="text-gray-600">{userSettings.username}</p>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Mail className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">Email</h3>
                  <p className="text-gray-600">{userSettings.email}</p>
                </div>
              </div>

              {/* Subscription */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  {getPlanIcon(userSettings.subscriptionPlan)}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">Subscription Plan</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getPlanBadgeColor(userSettings.subscriptionPlan)}`}>
                      {userSettings.subscriptionPlan}
                    </span>
                    {userSettings.expiresAt && (
                      <span className="text-xs text-gray-500">
                        Expires: {new Date(userSettings.expiresAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Plan Benefits */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-200">
                <h4 className="font-medium text-gray-900 mb-2">Current Plan Benefits</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  {userSettings.subscriptionPlan.toLowerCase() === 'free' && (
                    <>
                      <div>• Up to 3 database tables</div>
                      <div>• Basic export options</div>
                      <div>• Community support</div>
                    </>
                  )}
                  {userSettings.subscriptionPlan.toLowerCase() === 'pro' && (
                    <>
                      <div>• Unlimited database tables</div>
                      <div>• All export formats</div>
                      <div>• AI assistant</div>
                      <div>• Priority support</div>
                    </>
                  )}
                  {userSettings.subscriptionPlan.toLowerCase() === 'ultimate' && (
                    <>
                      <div>• Everything in Pro</div>
                      <div>• Team collaboration</div>
                      <div>• Advanced security</div>
                      <div>• Dedicated support</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* Logout Section */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors duration-200 font-medium"
            >
              <LogOut className="w-5 h-5" />
              Log Out
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              Need to update your plan?
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
