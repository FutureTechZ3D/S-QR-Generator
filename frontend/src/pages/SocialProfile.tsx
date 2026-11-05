import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, ArrowUp, ArrowDown, QrCode, Download, ExternalLink } from 'lucide-react';
import { listPlatforms, createProfile, getProfile, updateProfile, previewQR, getToken } from '@/services/api';
import type { Platform, SocialLink, SocialProfile as SocialProfileType, QRStyle } from '@/types';

const THEME_PRESETS = [
  { label: 'Blue',   theme: '#1D59F9', bg: '#FFFFFF' },
  { label: 'Dark',   theme: '#0F172A', bg: '#1E293B' },
  { label: 'Purple', theme: '#7C3AED', bg: '#FFFFFF' },
  { label: 'Green',  theme: '#16A34A', bg: '#FFFFFF' },
  { label: 'Red',    theme: '#DC2626', bg: '#FFFFFF' },
  { label: 'Orange', theme: '#EA580C', bg: '#FFFBF5' },
  { label: 'Pink',   theme: '#DB2777', bg: '#FFFFFF' },
  { label: 'Slate',  theme: '#475569', bg: '#F8FAFC' },
];

export default function SocialProfile() {
  const navigate   = useNavigate();
  const { id }     = useParams<{ id?: string }>();
  const isEdit     = !!id;

  const [platforms, setPlatforms]   = useState<Platform[]>([]);
  const [name, setName]             = useState('');
  const [username, setUsername]     = useState('');
  const [bio, setBio]               = useState('');
  const [avatarUrl, setAvatarUrl]   = useState('');
  const [themeColor, setThemeColor] = useState('#1D59F9');
  const [bgColor, setBgColor]       = useState('#FFFFFF');
  const [links, setLinks]           = useState<SocialLink[]>([]);
  const [addPlatform, setAddPlatform] = useState('');
  const [addUrl, setAddUrl]         = useState('');
  const [addTitle, setAddTitle]     = useState('');
  const [profileData, setProfileData] = useState<SocialProfileType | null>(null);
  const [qrB64, setQrB64]           = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [saved, setSaved]           = useState(false);

  useEffect(() => {
    listPlatforms().then(setPlatforms).catch(() => {});
    if (!getToken()) navigate('/login');
  }, [navigate]);

  useEffect(() => {
    if (isEdit && id) {
      getProfile(id).then(p => {
        setName(p.name); setUsername(p.username);
        setBio(p.bio || ''); setAvatarUrl(p.avatar_url || '');
        setThemeColor(p.theme_color); setBgColor(p.bg_color);
        setLinks(p.links); setProfileData(p);
      }).catch(() => navigate('/dashboard'));
    }
  }, [id, isEdit, navigate]);

  const platformMap: Record<string, Platform> = {};
  platforms.forEach(p => { platformMap[p.id] = p; });

  function addLink() {
    if (!addPlatform || !addUrl.trim()) return;
    setLinks(l => [...l, { platform_id: addPlatform, url: addUrl.trim(), title: addTitle.trim() || undefined }]);
    setAddUrl(''); setAddTitle(''); setAddPlatform('');
  }

  function removeLink(i: number) { setLinks(l => l.filter((_, idx) => idx !== i)); }
  function moveUp(i: number)     { if (i === 0) return; const l = [...links]; [l[i-1], l[i]] = [l[i], l[i-1]]; setLinks(l); }
  function moveDown(i: number)   { if (i === links.length - 1) return; const l = [...links]; [l[i], l[i+1]] = [l[i+1], l[i]]; setLinks(l); }

  async function generateProfileQR(slug: string) {
    const url = `${window.location.origin}/p/${slug}`;
    const style: QRStyle = { foreground: themeColor, background: bgColor, error_correct: 'H', box_size: 10, border: 4 };
    try {
      const res = await previewQR('social_profile', 'Profile QR', url, style);
      setQrB64(res.image_b64);
    } catch { /* silent */ }
  }

  async function handleSave() {
    if (!name.trim() || !username.trim()) { setError('Name and username are required'); return; }
    if (links.length === 0) { setError('Add at least one social link'); return; }
    setSaving(true); setError('');
    try {
      const data = { name, username, bio: bio || undefined, avatar_url: avatarUrl || undefined, theme_color: themeColor, bg_color: bgColor, links };
      let profile: SocialProfileType;
      if (isEdit && id) {
        profile = await updateProfile(id, data);
      } else {
        profile = await createProfile(data);
      }
      setProfileData(profile);
      await generateProfileQR(profile.slug);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
    setSaving(false);
  }

  function downloadQR() {
    if (!qrB64) return;
    const a = document.createElement('a');
    a.href = `data:image/png;base64,${qrB64}`;
    a.download = `${username || 'profile'}-qr.png`;
    a.click();
  }

  const landingUrl = profileData ? `${window.location.origin}/p/${profileData.slug}` : null;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 8 }}>
          🔗 {isEdit ? 'Edit Profile QR' : 'Create Social Profile QR'}
        </h1>
        <p style={{ color: 'var(--text-2)' }}>
          Combine all your social links into one scannable QR code with a beautiful landing page.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 28, alignItems: 'start' }}>
        {/* Left: Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Profile Info */}
          <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: 22 }}>
            <h2 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-2)' }}>Profile Info</h2>
            <div className="field__row">
              <div className="field">
                <label>Display name *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Sanjay Kumar" />
              </div>
              <div className="field">
                <label>Username *</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="sanjay_dev" />
              </div>
            </div>
            <div className="field">
              <label>Bio</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2} placeholder="Full-stack developer • Tech creator • Building cool stuff" />
            </div>
            <div className="field">
              <label>Avatar URL (optional)</label>
              <input type="url" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>

          {/* Theme */}
          <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: 22 }}>
            <h2 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-2)' }}>Theme</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {THEME_PRESETS.map(t => (
                <button
                  key={t.label}
                  title={t.label}
                  onClick={() => { setThemeColor(t.theme); setBgColor(t.bg); }}
                  style={{
                    width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
                    border: themeColor === t.theme ? `3px solid ${t.theme}` : '2px solid var(--border)',
                    background: `linear-gradient(135deg, ${t.theme} 50%, ${t.bg} 50%)`,
                    boxShadow: themeColor === t.theme ? `0 0 0 2px white, 0 0 0 4px ${t.theme}` : 'none',
                  }}
                />
              ))}
            </div>
            <div className="field__row">
              <div className="field">
                <label>Accent color</label>
                <div className="color-row">
                  <div className="color-swatch" style={{ background: themeColor }}>
                    <input type="color" value={themeColor} onChange={e => setThemeColor(e.target.value)} />
                  </div>
                  <input type="text" value={themeColor} onChange={e => setThemeColor(e.target.value)} style={{ flex: 1 }} />
                </div>
              </div>
              <div className="field">
                <label>Background</label>
                <div className="color-row">
                  <div className="color-swatch" style={{ background: bgColor, border: '1.5px solid var(--border)' }}>
                    <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} />
                  </div>
                  <input type="text" value={bgColor} onChange={e => setBgColor(e.target.value)} style={{ flex: 1 }} />
                </div>
              </div>
            </div>
          </div>

          {/* Social links */}
          <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: 22 }}>
            <h2 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-2)' }}>
              Social Links ({links.length})
            </h2>

            {/* Existing links */}
            {links.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {links.map((link, i) => {
                  const p = platformMap[link.platform_id];
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 8, border: '1.5px solid var(--border)' }}>
                      <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{p?.icon_emoji || '🔗'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: p?.color || 'var(--text)' }}>
                          {link.title || p?.name || link.platform_id}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {link.url}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button className="btn btn--ghost btn--xs" onClick={() => moveUp(i)} disabled={i === 0}><ArrowUp size={12} /></button>
                        <button className="btn btn--ghost btn--xs" onClick={() => moveDown(i)} disabled={i === links.length - 1}><ArrowDown size={12} /></button>
                        <button className="btn btn--danger btn--xs" onClick={() => removeLink(i)}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add new link */}
            <div style={{ background: 'var(--bg-3)', borderRadius: 10, padding: 14 }}>
              <p style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 10, color: 'var(--text-2)' }}>Add a link</p>
              <div className="field">
                <label>Platform</label>
                <select value={addPlatform} onChange={e => setAddPlatform(e.target.value)}>
                  <option value="">Select platform...</option>
                  {platforms.map(p => (
                    <option key={p.id} value={p.id}>{p.icon_emoji} {p.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>URL or username</label>
                <input type="text" value={addUrl} onChange={e => setAddUrl(e.target.value)} placeholder="https://... or @username" />
              </div>
              <div className="field" style={{ marginBottom: 10 }}>
                <label>Display title (optional)</label>
                <input type="text" value={addTitle} onChange={e => setAddTitle(e.target.value)} placeholder="Follow me on Instagram" />
              </div>
              <button className="btn btn--primary btn--sm" onClick={addLink} disabled={!addPlatform || !addUrl.trim()}>
                <Plus size={14} /> Add Link
              </button>
            </div>
          </div>

          {error && <div className="error">⚠ {error}</div>}

          <button className="btn btn--primary btn--full btn--lg" onClick={handleSave} disabled={saving}>
            {saving ? <><span className="spinner" /> Saving...</> : isEdit ? '💾 Update Profile' : '🔗 Create Profile QR'}
          </button>
        </div>

        {/* Right: Preview + QR */}
        <div style={{ position: 'sticky', top: 80, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Landing page preview */}
          <div style={{ background: bgColor, border: `2px solid ${themeColor}`, borderRadius: 14, padding: 20, textAlign: 'center' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: 12 }}>Landing Page Preview</p>
            {/* Avatar */}
            <div style={{
              width: 70, height: 70, borderRadius: '50%', margin: '0 auto 10px',
              background: themeColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.6rem', fontWeight: 800, color: 'white', border: `3px solid ${themeColor}`,
              overflow: 'hidden',
            }}>
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                : name ? name.charAt(0).toUpperCase() : '?'
              }
            </div>
            <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 2 }}>{name || 'Your Name'}</div>
            {username && <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginBottom: 6 }}>@{username}</div>}
            {bio && <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.5 }}>{bio}</div>}
            {links.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {links.slice(0, 5).map((link, i) => {
                  const p = platformMap[link.platform_id];
                  return (
                    <div key={i} style={{
                      padding: '10px 14px', borderRadius: 10, background: p?.color || themeColor,
                      color: 'white', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span>{p?.icon_emoji}</span>
                      <span style={{ flex: 1 }}>{link.title || p?.name}</span>
                    </div>
                  );
                })}
                {links.length > 5 && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>+{links.length - 5} more links</div>
                )}
              </div>
            )}
          </div>

          {/* QR code (shown after save) */}
          {qrB64 ? (
            <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: 20, textAlign: 'center' }}>
              <p style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 12, color: 'var(--text-2)' }}>Your Profile QR</p>
              <img src={`data:image/png;base64,${qrB64}`} alt="Profile QR" style={{ width: 180, height: 180, margin: '0 auto', display: 'block', imageRendering: 'pixelated' }} />
              <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', margin: '10px 0', wordBreak: 'break-all' }}>
                {landingUrl}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn--secondary btn--sm" style={{ flex: 1 }} onClick={downloadQR}>
                  <Download size={13} /> Download
                </button>
                {landingUrl && (
                  <a href={landingUrl} target="_blank" rel="noopener noreferrer" className="btn btn--primary btn--sm" style={{ flex: 1 }}>
                    <ExternalLink size={13} /> Preview
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-2)', border: '2px dashed var(--border)', borderRadius: 14, padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>
              <QrCode size={36} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              <p style={{ fontSize: '0.82rem' }}>QR code will appear here after saving</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
