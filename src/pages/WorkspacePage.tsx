import React from 'react';
import { DatabaseProvider } from '../context/DatabaseContext';
import MainLayout from "../components/allWorkSpace/layout/MainLayout";

export const WorkspacePage: React.FC = () => {
   return (
    <div className="min-h-screen font-sans">
      <DatabaseProvider>
        <MainLayout />
      </DatabaseProvider>
    </div>
  );
};

