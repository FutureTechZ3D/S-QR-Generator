import { useState } from 'react';
import { upgradePlan, getUser, setUser } from '@/services/api';

interface UpgradeModalProps {
  onClose: () => void;
  onUpgraded: () => void;
}

export default function UpgradeModal({ onClose, onUpgraded }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleUpgrade() {
    setLoading(true); setError('');
    try {
      await upgradePlan('pro');
      // Update local user
      const user = getUser();
      if (user) setUser({ ...user, plan: 'pro' });
      onUpgraded();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upgrade failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,}}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{background: 'var(--bg-1)', borderRadius: 16, padding: 32,
        maxWidth: 420, width: '90%', textAlign: 'center',}}>
        <div style={{fontSize: '2.5rem', marginBottom: 12}}>⭐</div>
        <h2 style={{margin: '0 0 12px', fontSize: '1.4rem'}}>Upgrade to PRO</h2>
        <p style={{color: 'var(--text-2)', marginBottom: 24, lineHeight: 1.6}}>
          This is a PRO feature. Upgrade your account to unlock platform themes,
          custom logos, SVG export, auto website logo fetch, and more.
        </p>
        {error && <p style={{color: '#DC2626', marginBottom: 12}}>⚠ {error}</p>}
        <div style={{display: 'flex', gap: 12, justifyContent: 'center'}}>
          <button
            className="btn btn--secondary"
            onClick={onClose}
            disabled={loading}
          >
            Not now
          </button>
          <button
            className="btn btn--primary"
            onClick={handleUpgrade}
            disabled={loading}
          >
            {loading ? 'Upgrading...' : 'Upgrade (Test)'}
          </button>
        </div>
      </div>
    </div>
  );
}
