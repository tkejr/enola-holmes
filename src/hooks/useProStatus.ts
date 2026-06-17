import { useState, useEffect, useCallback } from 'react';
import { hasProEntitlement, getCustomerInfo } from '@/utils/revenuecat';

export const useProStatus = () => {
  const [isPro, setIsPro] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [customerInfo, setCustomerInfo] = useState<any>(null);

  const checkProStatus = useCallback(async () => {
    try {
      setLoading(true);
      const [hasPro, info] = await Promise.all([
        hasProEntitlement(),
        getCustomerInfo(),
      ]);
      setIsPro(hasPro);
      setCustomerInfo(info);
    } catch (error) {
      console.error('Error checking pro status:', error);
      setIsPro(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkProStatus();
  }, [checkProStatus]);

  return {
    isPro,
    loading,
    customerInfo,
    refresh: checkProStatus,
  };
};

export const useProCheck = () => {
  const [isPro, setIsPro] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const hasPro = await hasProEntitlement();
        setIsPro(hasPro);
      } catch (error) {
        console.error('Error checking pro status:', error);
        setIsPro(false);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
  }, []);

  return { isPro, loading };
};
