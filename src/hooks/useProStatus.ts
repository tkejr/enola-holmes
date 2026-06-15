import { useState, useEffect, useCallback } from 'react';
import { hasProEntitlement } from '@/utils/revenuecat';

// Purchases disabled - native module not available in Expo Go

export const useProStatus = () => {
  const [isPro, setIsPro] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [customerInfo, setCustomerInfo] = useState<any>(null);

  const checkProStatus = useCallback(async () => {
    setLoading(false);
    setIsPro(false);
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
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    setIsPro(false);
    setLoading(false);
  }, []);

  return { isPro, loading };
};
