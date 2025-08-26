import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import axios from 'axios';

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

  const getAuthHeader = useCallback(() => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const loadPortfolios = useCallback(async () => {
    try {
      const headers = { 'Content-Type': 'application/json', ...getAuthHeader() };
      const res = await axios.get<Portfolio[]>('/portfolios', { headers });
      setPortfolios(res.data);
    } catch (err) {
      console.error('Portfolioları yükləmə xətası:', err);
      setPortfolios([]);
    }
  }, [getAuthHeader]);

  const savePortfolio = useCallback(async (name: string, scripts: string) => {
    try {
      const headers = { 'Content-Type': 'application/json', ...getAuthHeader() };
      const res = await axios.post<Portfolio>(
        '/portfolios',
        { name, scripts },
        { headers }
      );
      setPortfolios(prev => [res.data, ...prev]);
    } catch (err: any) {
      console.error('Portfolio saxlama xətası:', err);
      if (err.response?.data?.message) {
        throw new Error(err.response.data.message);
      }
      throw new Error('Portfolio saxlama xətası');
    }
  }, [getAuthHeader]);

  const deletePortfolio = useCallback(async (id: string) => {
    try {
      const headers = { 'Content-Type': 'application/json', ...getAuthHeader() };
      await axios.delete(`/portfolios/${id}`, { headers });
      setPortfolios(prev => prev.filter(p => p._id !== id));
    } catch (err) {
      console.error('Portfolio silmə xətası:', err);
    }
  }, [getAuthHeader]);

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
