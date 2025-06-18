import { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { userCreditService, UserCreditResponse } from '@/lib/userCreditService';

export function useUserCredit() {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [credit, setCredit] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCredit = async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await userCreditService.getUserCredit(getAccessTokenSilently);
      setCredit(response.credit);
    } catch (err) {
      console.error('Failed to fetch user credit:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch credit');
    } finally {
      setLoading(false);
    }
  };

  const updateCredit = async (newCredit: number) => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await userCreditService.setUserCredit(newCredit, getAccessTokenSilently);
      setCredit(response.credit);
      return response;
    } catch (err) {
      console.error('Failed to update user credit:', err);
      setError(err instanceof Error ? err.message : 'Failed to update credit');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const addCredit = async (amount: number) => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await userCreditService.addUserCredit(amount, getAccessTokenSilently);
      setCredit(response.credit);
      return response;
    } catch (err) {
      console.error('Failed to add user credit:', err);
      setError(err instanceof Error ? err.message : 'Failed to add credit');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deductCredit = async (amount: number) => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await userCreditService.deductUserCredit(amount, getAccessTokenSilently);
      setCredit(response.credit);
      return response;
    } catch (err) {
      console.error('Failed to deduct user credit:', err);
      setError(err instanceof Error ? err.message : 'Failed to deduct credit');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Fetch credit when user becomes authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchCredit();
    } else {
      setCredit(null);
      setError(null);
    }
  }, [isAuthenticated]);

  return {
    credit,
    loading,
    error,
    fetchCredit,
    updateCredit,
    addCredit,
    deductCredit,
  };
} 