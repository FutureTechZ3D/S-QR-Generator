import { useState, useEffect } from 'react';
import { getUser } from '@/services/api';

/**
 * Returns true if the current user is logged in and has a non-free plan.
 * Reads from localStorage and re-checks when storage changes.
 */
export function useIsPro(): boolean {
  const [isPro, setIsPro] = useState<boolean>(() => {
    const u = getUser();
    return !!u && u.plan !== 'free';
  });

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'qr_user') {
        const u = getUser();
        setIsPro(!!u && u.plan !== 'free');
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return isPro;
}

export default useIsPro;
