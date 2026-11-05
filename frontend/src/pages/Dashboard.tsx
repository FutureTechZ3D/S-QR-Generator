import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Download, Trash2, Edit3, Zap, QrCode, Link2, Copy } from 'lucide-react';
import {
  listQRCodes, deleteQRCode, getToken, downloadUrl,
  listProfiles, deleteProfile,
  listDynamicQRs, deleteDynamicQR,
} from '@/services/api';
import type { QRCode, SocialProfile, DynamicQR } from '@/types';
import { QR_TYPE_LABELS, QR_TYPE_ICONS } from '@/types';

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E1306C', whatsapp: '#25D366', youtube: '#FF0000',
  telegram: '#2CA5E0', x_twitter: '#000000', facebook: '#1877F2',
  linkedin_profile: '#0A66C2', linkedin_company: '#0A66C2',
  tiktok: '#010101', spotify: '#1DB954', github: '#181717',
  discord: '#5865F2', twitch: '#9146FF',
};

type Tab = 'all' | 'social' | 'social_profile' | 'dynamic' | 'website' | 'wifi' | 'contact' | 'video' | 'location';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'all',            label: 'All',            icon: '📋' },
  { id: 'social',         label: 'Social QR',      icon: '📱' },
  { id: 'social_profile', label: 'Profile QR',     icon: '🔗' },
  { id: 'dynamic',        label: 'Dynamic',        icon: '⚡' },
  { id: 'website',        label: 'Website',        icon: '🌐' },
  { id: 'wifi',           label: 'WiFi',           icon: '📶' },
  { id: 'contact',        label: 'Contact',        icon: '👤' },
  { id: 'video',          label: 'Video',          icon: '▶️' },
  { id: 'location',       label: 'Location',       icon: '📍' },
];

function SkeletonCard() {
  return (
    <div className="qr-card" style={{ opacity: 0.5 }}>
      <div style={{ width: 140, height: 140, background: 'var(--bg-2)', borderRadius: 8 }} />
      <div style={{ width: 100, height: 12, background: 'var(--bg-2)', borderRadius: 4 }} />
      <div style={{ width: 60, height: 20, background: 'var(--bg-2)', borderRadius: 99 }} />
    </div>
  );
}

function QRCard({ qr, onDelete }: { qr: QRCode; onDelete: (id: string) => void }) {
  const [copied, setCopied] = useState(false);

  async function duplicate() {
    // TODO: implement duplicate
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="qr-card">
      {qr.image_b64 ? (
        <img src={`data:image/png;base64,${qr.image_b64}`} alt={qr.title} />
      ) : (
        <div style={{ width: 140, height: 140, background: 'var(--bg-2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>
          {QR_TYPE_ICONS[qr.qr_type]}
        </div>
      )}
      <div className="qr-card__title" title={qr.title}>{qr.title}</div>
      {/* Badge row: type, platform, PRO, scan count */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
        <span className="qr-card__type">{QR_TYPE_ICONS[qr.qr_type]} {QR_TYPE_LABELS[qr.qr_type]}</span>
        {qr.qr_type === 'social' && qr.style?.platform_id && (
          <span
            className="platform-chip"
            style={{
              background: PLATFORM_COLORS[qr.style.platform_id] || '#6B7280',
              fontSize: '0.72rem',
              padding: '3px 10px',
              borderRadius: 20,
              color: 'white',
            }}
          >
            {qr.style.platform_id.replace('_', ' ')}
          </span>
        )}
        {(qr.style?.logo_b64 || qr.style?.fg_color_2 || qr.style?.corner_style === 'extra_rounded') && (
          <span className="pro-badge">PRO</span>
        )}
        {qr.scans > 0 && (
          <span style={{
            background: '#1D59F9',
            color: 'white',
            borderRadius: 20,
            padding: '2px 10px',
            fontSize: '0.72rem',
            fontWeight: 700,
          }}>
            {qr.scans} scan{qr.scans !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
        {new Date(qr.created_at).toLocaleDateString()}
      </div>
      <div className="qr-card__actions" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        <a href={downloadUrl(qr.id, 'image')} download={`${qr.title}.png`} className="btn btn--secondary btn--xs" title="Download PNG">
          <Download size={11} /> PNG
        </a>
        <a href={downloadUrl(qr.id, 'svg')} download={`${qr.title}.svg`} className="btn btn--secondary btn--xs" title="Download SVG">
          <Download size={11} /> SVG
        </a>
        <button
          className="btn btn--secondary"
          style={{ fontSize: '0.8rem', padding: '4px 12px' }}
          onClick={() => {
            if (qr.image_b64) {
              const a = document.createElement('a');
              a.href = `data:image/png;base64,${qr.image_b64}`;
              a.download = `${qr.title || 'qr'}.png`;
              a.click();
            }
          }}
          disabled={!qr.image_b64}
        >
          ⬇ PNG
        </button>
        <button className="btn btn--ghost btn--xs" onClick={duplicate} title="Duplicate">
          {copied ? '✓' : <Copy size={11} />}
        </button>
        <button className="btn btn--danger btn--xs" onClick={() => onDelete(qr.id)} title="Delete">
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

function ProfileCard({ profile, onDelete }: { profile: SocialProfile; onDelete: (id: string) => void }) {
  const landingUrl = `${window.location.origin}/p/${profile.slug}`;
  return (
    <div className="qr-card">
      <div style={{
        width: 140, height: 140, borderRadius: 12,
        background: `linear-gradient(135deg, ${profile.theme_color}, ${profile.theme_color}88)`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 6, color: 'white',
      }}>
        <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{profile.name.charAt(0).toUpperCase()}</div>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, opacity: 0.9 }}>{profile.links.length} links</div>
      </div>
      <div className="qr-card__title">{profile.name}</div>
      <span className="qr-card__type">🔗 Social Profile</span>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
        {profile.visits} visits · /p/{profile.slug}
      </div>
      <div className="qr-card__actions" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link to={`/profile/edit/${profile.id}`} className="btn btn--secondary btn--xs">
          <Edit3 size={11} /> Edit
        </Link>
        <a href={landingUrl} target="_blank" rel="noopener noreferrer" className="btn btn--secondary btn--xs">
          <Link2 size={11} /> View
        </a>
        <button className="btn btn--danger btn--xs" onClick={() => onDelete(profile.id)}>
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

function DynamicCard({ dqr, onDelete }: { dqr: DynamicQR; onDelete: (id: string) => void }) {
  return (
    <div className="qr-card">
      <div style={{
        width: 140, height: 140, borderRadius: 12,
        background: dqr.is_active ? 'linear-gradient(135deg, #7C3AED, #1D59F9)' : '#94A3B8',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 6, color: 'white',
      }}>
        <Zap size={32} />
        <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>{dqr.redirect_count} scans</div>
      </div>
      <div className="qr-card__title">{dqr.title}</div>
      <span className="qr-card__type">⚡ Dynamic QR</span>
      <div style={{ fontSize: '0.72rem', color: dqr.is_active ? 'var(--green)' : 'var(--red)' }}>
        {dqr.is_active ? '● Active' : '● Inactive'}
        {dqr.expires_at && ` · Expires ${new Date(dqr.expires_at).toLocaleDateString()}`}
      </div>
      <div className="qr-card__actions">
        <button className="btn btn--danger btn--xs" onClick={() => onDelete(dqr.id)}>
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [tab, setTab]           = useState<Tab>('all');
  const [qrCodes, setQrCodes]   = useState<QRCode[]>([]);
  const [profiles, setProfiles] = useState<SocialProfile[]>([]);
  const [dynamicQrs, setDynamic] = useState<DynamicQR[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!getToken()) { navigate('/login'); return; }
    Promise.all([
      listQRCodes().catch(() => [] as QRCode[]),
      listProfiles().catch(() => [] as SocialProfile[]),
      listDynamicQRs().catch(() => [] as DynamicQR[]),
    ]).then(([qrs, prfs, dyns]) => {
      setQrCodes(qrs); setProfiles(prfs); setDynamic(dyns);
      setLoading(false);
    });
  }, [navigate]);

  async function handleDeleteQR(id: string) {
    if (!confirm('Delete this QR code?')) return;
    await deleteQRCode(id);
    setQrCodes(c => c.filter(q => q.id !== id));
  }

  async function handleDeleteProfile(id: string) {
    if (!confirm('Delete this profile?')) return;
    await deleteProfile(id);
    setProfiles(p => p.filter(x => x.id !== id));
  }

  async function handleDeleteDynamic(id: string) {
    if (!confirm('Delete this Dynamic QR?')) return;
    await deleteDynamicQR(id);
    setDynamic(d => d.filter(x => x.id !== id));
  }

  // Filter based on active tab
  const filteredQR = qrCodes.filter(q => {
    if (tab === 'all')    return true;
    if (tab === 'social') return q.qr_type === 'social';
    if (tab === 'dynamic') return q.qr_type === 'dynamic';
    if (tab === 'website') return ['url', 'text'].includes(q.qr_type);
    if (tab === 'wifi')    return q.qr_type === 'wifi';
    if (tab === 'contact') return ['vcard', 'email', 'phone', 'sms'].includes(q.qr_type);
    if (tab === 'video')   return ['youtube', 'youtube_channel', 'youtube_video'].includes(q.qr_type);
    if (tab === 'location') return q.qr_type === 'location';
    return false;
  });

  const showProfiles = tab === 'all' || tab === 'social_profile';
  const showDynamic  = tab === 'all' || tab === 'dynamic';

  const totalCount = qrCodes.length + profiles.length + dynamicQrs.length;

  return (
    <div className="container" style={{ padding: '32px 24px' }}>
      {/* Header */}
      <div className="dashboard__header">
        <div>
          <h1 className="dashboard__title">📋 My QR Codes</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-2)', marginTop: 4 }}>
            {totalCount} total — {qrCodes.length} QR codes · {profiles.length} profiles · {dynamicQrs.length} dynamic
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/social" className="btn btn--secondary btn--sm">
            <Link2 size={14} /> Social QR
          </Link>
          <Link to="/profile/create" className="btn btn--secondary btn--sm">
            <Zap size={14} /> Profile QR
          </Link>
          <Link to="/" className="btn btn--primary btn--sm">
            <Plus size={14} /> Create QR
          </Link>
        </div>
      </div>

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`btn btn--sm ${tab === t.id ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setTab(t.id)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="qr-grid">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : totalCount === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon"><QrCode size={48} /></div>
          <p style={{ fontSize: '1rem', marginBottom: 20 }}>
            No QR codes yet. Create your first one!
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/"               className="btn btn--primary">🌐 URL QR Code</Link>
            <Link to="/social"         className="btn btn--secondary">📱 Social QR</Link>
            <Link to="/profile/create" className="btn btn--secondary">🔗 Profile QR</Link>
          </div>
        </div>
      ) : (
        <>
          {/* Social Profiles section */}
          {showProfiles && profiles.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: 16 }}>
                🔗 Social Profiles ({profiles.length})
              </h2>
              <div className="qr-grid">
                {profiles.map(p => (
                  <ProfileCard key={p.id} profile={p} onDelete={handleDeleteProfile} />
                ))}
              </div>
            </div>
          )}

          {/* Dynamic QRs section */}
          {showDynamic && dynamicQrs.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: 16 }}>
                ⚡ Dynamic QR Codes ({dynamicQrs.length})
              </h2>
              <div className="qr-grid">
                {dynamicQrs.map(d => (
                  <DynamicCard key={d.id} dqr={d} onDelete={handleDeleteDynamic} />
                ))}
              </div>
            </div>
          )}

          {/* Regular QR codes */}
          {filteredQR.length > 0 && (
            <div>
              {(tab === 'all') && (
                <h2 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: 16 }}>
                  📋 QR Codes ({filteredQR.length})
                </h2>
              )}
              <div className="qr-grid">
                {filteredQR.map(qr => (
                  <QRCard key={qr.id} qr={qr} onDelete={handleDeleteQR} />
                ))}
              </div>
            </div>
          )}

          {/* Empty filtered state */}
          {filteredQR.length === 0 && !showProfiles && !showDynamic && (
            <div className="empty-state">
              <div className="empty-state__icon">🔍</div>
              <p>No {TABS.find(t => t.id === tab)?.label} QR codes yet.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
