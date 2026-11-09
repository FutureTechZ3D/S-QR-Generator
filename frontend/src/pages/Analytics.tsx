import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getDynamicAnalytics, getToken } from '@/services/api';
import type { DynamicAnalytics, NamedCount } from '@/types';

const RANGES = [7, 30, 90];

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="qr-card" style={{ flex: 1, minWidth: 140, alignItems: 'center' }}>
      <div style={{ fontSize: '1.9rem', fontWeight: 800 }}>{value.toLocaleString()}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
    </div>
  );
}

function BarList({ title, items }: { title: string; items: NamedCount[] }) {
  const max = Math.max(1, ...items.map(i => i.count));
  return (
    <div className="qr-card" style={{ flex: 1, minWidth: 240, alignItems: 'stretch' }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      {items.length === 0 && <div style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>No data yet</div>}
      {items.map(i => (
        <div key={i.name} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{i.name}</span>
            <b>{i.count}</b>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--border, #e5e7eb)' }}>
            <div style={{ width: `${(i.count / max) * 100}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg,#7C3AED,#1D59F9)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Series({ daily }: { daily: DynamicAnalytics['daily'] }) {
  const max = Math.max(1, ...daily.map(d => d.count));
  const W = 600, H = 140, bw = W / daily.length;
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Scans per day">
      {daily.map((d, i) => {
        const h = (d.count / max) * H;
        return (
          <rect key={d.date} x={i * bw + 1} y={H - h} width={Math.max(1, bw - 2)} height={h} rx={2} fill="#1D59F9">
            <title>{`${d.date}: ${d.count} scans`}</title>
          </rect>
        );
      })}
      <text x={0} y={H + 14} fontSize={10} fill="currentColor" opacity={0.6}>{daily[0]?.date}</text>
      <text x={W} y={H + 14} fontSize={10} fill="currentColor" opacity={0.6} textAnchor="end">{daily[daily.length - 1]?.date}</text>
    </svg>
  );
}

export default function Analytics() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<DynamicAnalytics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) { navigate('/login'); return; }
    setError('');
    getDynamicAnalytics(id, days).then(setData).catch(e => setError(e.message));
  }, [id, days, navigate]);

  return (
    <div className="dashboard" style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
      <Link to="/dashboard" className="btn btn--ghost btn--xs"><ArrowLeft size={12} /> Dashboard</Link>
      <h1 style={{ margin: '16px 0' }}>Scan analytics</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {RANGES.map(r => (
          <button key={r} className={`btn btn--xs ${r === days ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setDays(r)}>
            Last {r} days
          </button>
        ))}
      </div>
      {error && <p style={{ color: 'var(--red)' }}>{error}</p>}
      {!data && !error && <p>Loading…</p>}
      {data && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <Stat label="Total scans" value={data.total_scans} />
            <Stat label={`Last ${data.days} days`} value={data.period_scans} />
            <Stat label="Unique visitors" value={data.unique} />
          </div>
          <div className="qr-card" style={{ alignItems: 'stretch', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Scans per day</div>
            <Series daily={data.daily} />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <BarList title="Devices" items={data.devices} />
            <BarList title="Operating systems" items={data.os} />
            <BarList title="Countries" items={data.countries} />
            <BarList title="Referrers" items={data.referrers} />
          </div>
        </>
      )}
    </div>
  );
}
