import React from 'react';

interface ProGateProps {
  feature: string;
  isPro: boolean;
  onUpgradeClick: () => void;
  children: React.ReactNode;
}

export default function ProGate({ isPro, onUpgradeClick, children }: ProGateProps) {
  if (isPro) return <>{children}</>;
  return (
    <div className="pro-gate">
      {children}
      <div className="pro-gate__overlay" onClick={onUpgradeClick}>
        <span style={{fontSize: '1.5rem', marginBottom: 6}}>🔒</span>
        <span className="pro-badge">PRO</span>
        <span style={{fontSize: '0.75rem', color: 'var(--text-2)', marginTop: 4, textAlign: 'center'}}>
          Click to upgrade
        </span>
      </div>
    </div>
  );
}
