import React from 'react';
import { Wifi, WifiOff, AlertCircle, Info } from 'lucide-react';

interface CollaborationStatusProps {
  isConnected: boolean;
  error?: string | null;
  showDetails?: boolean;
}

const CollaborationStatus: React.FC<CollaborationStatusProps> = ({ 
  isConnected, 
  error, 
  showDetails = false 
}) => {
  if (!showDetails && isConnected) return null;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
      isConnected 
        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
        : error
        ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
    }`}>
      {isConnected ? (
        <>
          <Wifi className="w-4 h-4" />
          <span>Real-time collaboration active</span>
        </>
      ) : error ? (
        <>
          <Info className="w-4 h-4" />
          <span>Collaboration offline (working locally)</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          <span>Connecting...</span>
        </>
      )}
    </div>
  );
};

export default CollaborationStatus;