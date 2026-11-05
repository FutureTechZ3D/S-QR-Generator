import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Save, Search, QrCode } from 'lucide-react';
import { listPlatforms, generateSocialQR, getToken } from '@/services/api';
import type { Platform, QRStyle } from '@/types';
import { DEFAULT_STYLE } from '@/types';

const CATEGORIES = [
  { id: 'all',           label: 'All' },
  { id: 'social',        label: '📱 Social' },
  { id: 'video',         label: '▶️ Video' },
  { id: 'messaging',     label: '💬 Messaging' },
  { id: 'professional',  label: '💼 Professional' },
  { id: 'music',         label: '🎵 Music' },
  { id: 'email_contact', label: '✉️ Contact' },
];

export default function SocialQR() {
  const navigate = useNavigate();
  const [platforms, setPlatforms]   = useState<Platform[]>([]);
  const [selected, setSelected]     = useState<Platform | null>(null);
  const [category, setCategory]     = useState('all');
  const [search, setSearch]         = useState('');
  const [input, setInput]           = useState('');
  const [title, setTitle]           = useState('');
  const [style, setStyle]           = useState<QRStyle>({ ...DEFAULT_STYLE });
  const [previewB64, setPreviewB64] = useState<string | null>(null);
  const [builtUrl, setBuiltUrl]     = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    listPlatforms().then(setPlatforms).catch(() => {});
  }, []);

  const filtered = platforms.filter(p => {
    const matchCat = category === 'all' || p.category === category;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // Build URL from username input
  function buildUrl(platform: Platform, value: string): string {
    if (!value.trim()) return '';
    const tpl = platform.url_template;
    if (tpl.includes('{username}')) return tpl.replace('{username}', value.trim());
    if (tpl.includes('{url}')) {
      const v = value.trim();
      return v.startsWith('http') ? v : 'https://' + v;
    }
    return value.trim();
  }

  const triggerPreview = useCallback((platform: Platform, value: string, s: QRStyle) => {
    const url = buildUrl(platform, value);
    if (!url) { setPreviewB64(null); return; }
    setBuiltUrl(url);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setGenerating(true);
      try {
        const res = await generateSocialQR({
          platform_id: platform.id,
          username_or_url: value,
          title: title || platform.name,
          style: { ...s, platform_id: platform.id },
        });
        setPreviewB64(res.image_b64);
      } catch { /* silent */ }
      setGenerating(false);
    }, 600);
  }, [title]);

  function selectPlatform(p: Platform) {
    setSelected(p);
    setInput('');
    setPreviewB64(null);
    setBuiltUrl('');
    setError('');
    setStyle({ ...DEFAULT_STYLE, foreground: p.color });
    setTitle(p.name);
  }

  function handleInput(v: string) {
    setInput(v);
    if (selected) triggerPreview(selected, v, style);
  }

  function handleStyleChange(key: keyof QRStyle, val: string | number | boolean) {
    const ns = { ...style, [key]: val };
    setStyle(ns);
    if (selected && input) triggerPreview(selected, input, ns);
  }

  function downloadPreview() {
    if (!previewB64) return;
    const a = document.createElement('a');
    a.href = `data:image/png;base64,${previewB64}`;
    a.download = `${title || selected?.name || 'social'}-qr.png`;
    a.click();
  }

  async function handleSave() {
    if (!getToken()) { navigate('/login'); return; }
    if (!selected || !input.trim()) { setError('Please select a platform and enter your username or URL'); return; }
    setSaving(true); setError('');
    try {
      await generateSocialQR({
        platform_id: selected.id,
        username_or_url: input,
        title: title || selected.name,
        style: { ...style, platform_id: selected.id },
        save: true,
      });
      navigate('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
      setSaving(false);
    }
  }

  const inputLabel = selected
    ? (selected.url_template.includes('{username}')
        ? `${selected.name} username ${selected.username_prefix ? `(${selected.username_prefix})` : ''}`
        : `${selected.name} URL`)
    : 'Username or URL';

  const inputPlaceholder = selected
    ? (selected.url_template.includes('{username}')
        ? `${selected.username_prefix}yourhandle`
        : `https://...`)
    : 'Select a platform first';

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 8 }}>
          📱 Social Media QR
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: '1rem' }}>
          Generate a QR code for any social media platform, messaging app, or professional network.
        </p>
      </div>

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, justifyContent: 'center' }}>
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            className={`btn btn--sm ${category === c.id ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 360, margin: '0 auto 24px' }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
        <input
          type="text" placeholder="Search platforms..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '9px 12px 9px 36px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.875rem' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 28, alignItems: 'start' }}>
        {/* Platform grid */}
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
            {filtered.map(p => (
              <button
                key={p.id}
                onClick={() => selectPlatform(p)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 6, padding: '14px 8px',
                  border: `2px solid ${selected?.id === p.id ? p.color : 'var(--border)'}`,
                  borderRadius: 10, cursor: 'pointer', background: 'white',
                  transition: 'all 0.15s',
                  boxShadow: selected?.id === p.id ? `0 0 0 3px ${p.color}22` : 'none',
                }}
              >
                <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{p.icon_emoji}</span>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 600, textAlign: 'center',
                  color: selected?.id === p.id ? p.color : 'var(--text-2)',
                  lineHeight: 1.3,
                }}>
                  {p.name}
                </span>
              </button>
            ))}
          </div>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>
              No platforms found for "{search}"
            </div>
          )}
        </div>

        {/* Form + Preview */}
        <div style={{ position: 'sticky', top: 80, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {selected ? (
            <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: 22 }}>
              {/* Selected platform header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, padding: '10px 14px', borderRadius: 10, background: `${selected.color}14` }}>
                <span style={{ fontSize: '1.6rem' }}>{selected.icon_emoji}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: selected.color }}>{selected.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', textTransform: 'capitalize' }}>{selected.category}</div>
                </div>
              </div>

              <div className="field">
                <label>{inputLabel}</label>
                <input
                  type="text"
                  value={input}
                  onChange={e => handleInput(e.target.value)}
                  placeholder={inputPlaceholder}
                  autoFocus
                />
                {builtUrl && (
                  <p className="field__hint" style={{ marginTop: 4, wordBreak: 'break-all' }}>
                    → {builtUrl}
                  </p>
                )}
              </div>

              <div className="field">
                <label>QR Code title</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={selected.name} />
              </div>

              {/* Color pickers */}
              <div className="field__row" style={{ marginBottom: 14 }}>
                <div className="field">
                  <label>QR Color</label>
                  <div className="color-row">
                    <div className="color-swatch" style={{ background: style.foreground }}>
                      <input type="color" value={style.foreground} onChange={e => handleStyleChange('foreground', e.target.value)} />
                    </div>
                    <input type="text" value={style.foreground} onChange={e => handleStyleChange('foreground', e.target.value)} style={{ flex: 1 }} />
                  </div>
                </div>
                <div className="field">
                  <label>Corner style</label>
                  <select value={style.corner_style || 'square'} onChange={e => handleStyleChange('corner_style', e.target.value)}>
                    <option value="square">Square</option>
                    <option value="rounded">Rounded</option>
                    <option value="extra_rounded">Extra Rounded</option>
                  </select>
                </div>
              </div>

              {error && <div className="error" style={{ marginBottom: 12 }}>⚠ {error}</div>}

              {/* QR Preview */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 16, background: 'var(--bg-2)', borderRadius: 10, marginBottom: 14 }}>
                {generating ? (
                  <span className="spinner spinner--brand" style={{ width: 24, height: 24 }} />
                ) : previewB64 ? (
                  <img src={`data:image/png;base64,${previewB64}`} alt="QR preview" style={{ width: 180, height: 180, imageRendering: 'pixelated' }} />
                ) : (
                  <div style={{ width: 180, height: 180, background: 'white', border: '2px dashed var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                    <QrCode size={32} style={{ opacity: 0.2 }} />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Enter your handle</p>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn--secondary" style={{ flex: 1 }} onClick={downloadPreview} disabled={!previewB64}>
                  <Download size={15} /> PNG
                </button>
                <button className="btn btn--primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving || !previewB64}>
                  {saving ? <><span className="spinner" /> Saving...</> : <><Save size={15} /> Save</>}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-2)', border: '2px dashed var(--border)', borderRadius: 14, padding: 32, textAlign: 'center', color: 'var(--text-3)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>👈</div>
              <p style={{ fontSize: '0.9rem' }}>Select a platform from the left to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
