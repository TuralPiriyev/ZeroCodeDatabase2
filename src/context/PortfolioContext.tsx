import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { apiService } from '../services/apiService';

export interface Portfolio {
  _id: string;
  name: string;
  scripts: string;
  createdAt: string;
}

interface PortfolioContextType {
  portfolios: Portfolio[];
  loadPortfolios: () => Promise<void>;
  savePortfolio: (name: string, scripts: string) => Promise<void>;
  deletePortfolio: (id: string) => Promise<void>;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export const PortfolioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);

  const loadPortfolios = useCallback(async () => {
    try {
  // Use central apiService which handles base URL and Authorization header
  // note: apiService.baseURL may already include the '/api' prefix in some deployments,
  // so keep endpoints consistent with other callers (no leading '/api').
  const res = await apiService.get('/portfolios');
      // apiService returns parsed JSON array
      setPortfolios(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Portfolioları yükləmə xətası:', err);
      setPortfolios([]);
    }
  }, []);

  const savePortfolio = useCallback(async (name: string, scripts: string) => {
    try {
  const res = await apiService.post('/portfolios', { name, scripts });
      const data = res;
      setPortfolios(prev => {
        const existingIndex = prev.findIndex(p => p._id === data._id);
        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = data;
          return next;
        }
        return [data, ...prev];
      });
    } catch (err: any) {
      console.error('Portfolio saxlama xətası:', err);
      if (err.message) {
        throw new Error(err.message);
      }
      throw new Error('Portfolio saxlama xətası');
    }
  }, []);

  const deletePortfolio = useCallback(async (id: string) => {
    try {
  await apiService.delete(`/portfolios/${id}`);
      setPortfolios(prev => prev.filter(p => p._id !== id));
    } catch (err) {
      console.error('Portfolio silmə xətası:', err);
    }
  }, []);

  useEffect(() => {
    if (localStorage.getItem('token')) {
      loadPortfolios();
    }
  }, [loadPortfolios]);

  return (
    <PortfolioContext.Provider
      value={{ portfolios, loadPortfolios, savePortfolio, deletePortfolio }}
    >
      {children}
    </PortfolioContext.Provider>
  );
};

export const usePortfolio = (): PortfolioContextType => {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error('usePortfolio PortfolioProvider daxilində istifadə olunmalıdır');
  return ctx;
};
