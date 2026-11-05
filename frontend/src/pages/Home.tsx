import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  QrCode, Globe, FileText, Mail, Phone, MessageSquare,
  Wifi, User, MapPin, Youtube, Shield, Zap, Download, Save
} from 'lucide-react';
import { previewQR, createQR, getToken, detectPlatform, getTheme } from '@/services/api';
import type { QRType, QRStyle, PlatformDetection, QRTheme } from '@/types';
import { QR_TYPE_LABELS, DEFAULT_STYLE } from '@/types';
import ProGate from '@/components/ProGate';
import UpgradeModal from '@/components/UpgradeModal';

// ── QR Type definitions ──────────────────────────────────────────────
const QR_TYPES: { type: QRType; icon: React.ReactNode; label: string }[] = [
  { type: 'url',      icon: <Globe size={18}/>,          label: 'URL' },
  { type: 'text',     icon: <FileText size={18}/>,       label: 'Text' },
  { type: 'email',    icon: <Mail size={18}/>,           label: 'Email' },
  { type: 'phone',    icon: <Phone size={18}/>,          label: 'Phone' },
  { type: 'sms',      icon: <MessageSquare size={18}/>,  label: 'SMS' },
  { type: 'wifi',     icon: <Wifi size={18}/>,           label: 'WiFi' },
  { type: 'vcard',    icon: <User size={18}/>,           label: 'Contact' },
  { type: 'location', icon: <MapPin size={18}/>,         label: 'Location' },
  { type: 'youtube',  icon: <Youtube size={18}/>,        label: 'YouTube' },
];

// ── Content form per QR type ─────────────────────────────────────────
function ContentForm({
  type, value, onChange
}: { type: QRType; value: string; onChange: (v: string) => void }) {

  const common = (placeholder: string, rows = 1) => (
    rows === 1
      ? <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      : <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} />
  );

  switch (type) {
    case 'url':
      return (
        <div className="field">
          <label>Website URL</label>
          <input type="url" value={value} onChange={e => onChange(e.target.value)}
            placeholder="https://example.com" />
          <p className="field__hint">Include https:// for best compatibility</p>
        </div>
      );
    case 'text':
      return (
        <div className="field">
          <label>Text content</label>
          <textarea value={value} onChange={e => onChange(e.target.value)}
            rows={4} placeholder="Enter any text..." />
        </div>
      );
    case 'email':
      return (
        <div className="field">
          <label>Email details</label>
          {common('email@example.com | Subject | Body message')}
          <p className="field__hint">Format: email | subject | body (all optional except email)</p>
        </div>
      );
    case 'phone':
      return (
        <div className="field">
          <label>Phone number</label>
          <input type="tel" value={value} onChange={e => onChange(e.target.value)}
            placeholder="+91 9876543210" />
        </div>
      );
    case 'sms':
      return (
        <div className="field">
          <label>SMS details</label>
          {common('+91 9876543210 | Your message here')}
          <p className="field__hint">Format: phone number | message</p>
        </div>
      );
    case 'wifi':
      return (
        <>
          <div className="field">
            <label>WiFi Network (SSID)</label>
            {common('MyNetworkName | password | WPA | false')}
            <p className="field__hint">Format: SSID | password | WPA/WEP/nopass | hidden(true/false)</p>
          </div>
        </>
      );
    case 'vcard':
      return (
        <div className="field">
          <label>Contact details</label>
          <textarea value={value} onChange={e => onChange(e.target.value)}
            rows={4} placeholder="Full Name | +91 9876543210 | email@example.com | Company | https://website.com | Address" />
          <p className="field__hint">Format: name | phone | email | org | url | address</p>
        </div>
      );
    case 'location':
      return (
        <div className="field">
          <label>Coordinates</label>
          {common('13.0827 | 80.2707')}
          <p className="field__hint">Format: latitude | longitude</p>
        </div>
      );
    case 'youtube':
      return (
        <div className="field">
          <label>YouTube URL or Video ID</label>
          {common('https://youtube.com/watch?v=dQw4w9WgXcQ')}
        </div>
      );
    default:
      return (
        <div className="field">
          <label>Content</label>
          {common('Enter content...')}
        </div>
      );
  }
}

// ── Static preset themes ─────────────────────────────────────────────
const PRESET_THEMES: Array<{
  platform_id: string;
  name: string;
  fg_color: string;
  bg_color: string;
  fg_color_2: string;
  corner_style: 'square' | 'rounded' | 'extra_rounded';
  error_correct: string;
  description: string;
}> = [
  { platform_id: 'instagram',       name: 'Instagram',   fg_color: '#E1306C', bg_color: '#FFFFFF', fg_color_2: '#833AB4', corner_style: 'extra_rounded', error_correct: 'H', description: 'Instagram gradient' },
  { platform_id: 'whatsapp',        name: 'WhatsApp',    fg_color: '#25D366', bg_color: '#FFFFFF', fg_color_2: '#25D366', corner_style: 'rounded',       error_correct: 'H', description: 'WhatsApp green' },
  { platform_id: 'youtube',         name: 'YouTube',     fg_color: '#FF0000', bg_color: '#FFFFFF', fg_color_2: '#CC0000', corner_style: 'square',        error_correct: 'H', description: 'YouTube red' },
  { platform_id: 'telegram',        name: 'Telegram',    fg_color: '#2CA5E0', bg_color: '#FFFFFF', fg_color_2: '#2CA5E0', corner_style: 'rounded',       error_correct: 'H', description: 'Telegram blue' },
  { platform_id: 'x_twitter',       name: 'X (Twitter)', fg_color: '#000000', bg_color: '#FFFFFF', fg_color_2: '#000000', corner_style: 'square',        error_correct: 'H', description: 'X minimal' },
  { platform_id: 'facebook',        name: 'Facebook',    fg_color: '#1877F2', bg_color: '#FFFFFF', fg_color_2: '#1877F2', corner_style: 'rounded',       error_correct: 'H', description: 'Facebook blue' },
  { platform_id: 'linkedin_profile',name: 'LinkedIn',    fg_color: '#0A66C2', bg_color: '#FFFFFF', fg_color_2: '#0A66C2', corner_style: 'rounded',       error_correct: 'H', description: 'LinkedIn blue' },
  { platform_id: 'tiktok',          name: 'TikTok',      fg_color: '#010101', bg_color: '#FFFFFF', fg_color_2: '#69C9D0', corner_style: 'square',        error_correct: 'H', description: 'TikTok' },
];

const PRESET_EMOJIS: Record<string, string> = {
  instagram: '📸', whatsapp: '💬', youtube: '▶️', telegram: '✈️',
  x_twitter: '𝕏', facebook: '👤', linkedin_profile: '💼', tiktok: '🎵',
};

// ── Main Home Page ────────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate();

  const [activeType, setActiveType] = useState<QRType>('url');
  const [title, setTitle]           = useState('');
  const [content, setContent]       = useState('');
  const [style, setStyle]           = useState<QRStyle>({ ...DEFAULT_STYLE });
  const [previewB64, setPreviewB64] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [detectedPlatform, setDetectedPlatform] = useState<PlatformDetection | null>(null);
  const [appliedTheme, setAppliedTheme] = useState<QRTheme | null>(null);
  const detectDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Pro state
  const [isPro, setIsPro] = useState<boolean>(() => {
    try {
      const u = JSON.parse(localStorage.getItem('qr_user') || '{}');
      return u?.plan && u.plan !== 'free';
    } catch { return false; }
  });
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Auto-preview as user types (debounced 600ms)
  const triggerPreview = useCallback((
    t: QRType, c: string, s: QRStyle
  ) => {
    if (!c.trim()) { setPreviewB64(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setGenerating(true);
      try {
        const res = await previewQR(t, title || 'Preview', c, s);
        setPreviewB64(res.image_b64);
      } catch { /* silent */ }
      setGenerating(false);
    }, 600);
  }, [title]);

  function handleTypeChange(t: QRType) {
    setActiveType(t); setContent(''); setPreviewB64(null);
  }

  const handleUrlDetection = useCallback(async (url: string) => {
    if (!url || !url.startsWith('http')) {
      setDetectedPlatform(null);
      setAppliedTheme(null);
      return;
    }
    if (detectDebounceRef.current) clearTimeout(detectDebounceRef.current);
    detectDebounceRef.current = setTimeout(async () => {
      try {
        const { platform } = await detectPlatform(url);
        if (platform) {
          setDetectedPlatform(platform);
          // Fetch and auto-apply the platform theme
          const theme = await getTheme(platform.suggested_theme);
          if (theme) {
            setAppliedTheme(theme);
            const newStyle: QRStyle = {
              ...style,
              foreground: theme.fg_color,
              background: theme.bg_color,
              fg_color_2: theme.fg_color_2 !== theme.fg_color ? theme.fg_color_2 : undefined,
              corner_style: theme.corner_style,
              error_correct: theme.error_correct,
            };
            setStyle(newStyle);
            triggerPreview(activeType, url, newStyle);
          }
        } else {
          setDetectedPlatform(null);
          setAppliedTheme(null);
        }
      } catch {
        // Silent failure — platform detection is non-critical
      }
    }, 400);
  }, [style, activeType, triggerPreview]);

  function handleContentChange(v: string) {
    setContent(v);
    triggerPreview(activeType, v, style);
    if (activeType === 'url') {
      handleUrlDetection(v);
    }
  }

  function clearTheme() {
    setDetectedPlatform(null);
    setAppliedTheme(null);
    const resetStyle = { ...DEFAULT_STYLE };
    setStyle(resetStyle);
    if (content) triggerPreview(activeType, content, resetStyle);
  }

  function handleStyleChange(key: keyof QRStyle, value: string | number | boolean) {
    const newStyle = { ...style, [key]: value };
    setStyle(newStyle);
    if (content) triggerPreview(activeType, content, newStyle);
  }

  // Download current preview as PNG
  function downloadPreview() {
    if (!previewB64) return;
    const a = document.createElement('a');
    a.href = `data:image/png;base64,${previewB64}`;
    a.download = `${title || activeType}-qr.png`;
    a.click();
  }

  // Save to account
  async function handleSave() {
    if (!getToken()) { navigate('/login'); return; }
    if (!content.trim() || !title.trim()) {
      setError('Please enter a title and content first');
      return;
    }
    setSaving(true); setError('');
    try {
      await createQR(activeType, title, content, style);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  }

  function handleApplyPreset(preset: typeof PRESET_THEMES[0]) {
    if (!isPro) {
      setShowUpgradeModal(true);
      return;
    }
    const newStyle: QRStyle = {
      ...style,
      foreground: preset.fg_color,
      background: preset.bg_color,
      fg_color_2: preset.fg_color_2 !== preset.fg_color ? preset.fg_color_2 : undefined,
      corner_style: preset.corner_style,
      error_correct: preset.error_correct,
    };
    setStyle(newStyle);
    if (content) triggerPreview(activeType, content, newStyle);
  }

  async function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('Logo must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(',')[1];
      const newStyle = { ...style, logo_b64: b64, logo_padding: true };
      setStyle(newStyle);
      if (content) triggerPreview(activeType, content, newStyle);
    };
    reader.readAsDataURL(file);
  }

  function handleLogoDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('Logo must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(',')[1];
      const newStyle = { ...style, logo_b64: b64, logo_padding: true };
      setStyle(newStyle);
      if (content) triggerPreview(activeType, content, newStyle);
    };
    reader.readAsDataURL(file);
  }

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="container">
          <div className="hero__badge">
            <QrCode size={12} /> Free QR Code Generator
          </div>
          <h1 className="hero__title">
            Create your QR code<br />
            <span>in seconds</span>
          </h1>
          <p className="hero__subtitle">
            Generate customizable QR codes for websites, WiFi, contacts, and more.
            No sign-up required. Download instantly in PNG or SVG.
          </p>

          {/* ── Studio 3-panel layout ──────────────────────────── */}
          <div className="studio">

            {/* LEFT PANEL */}
            <div className="studio__left">

              {/* QR type selector */}
              <div className="qr-types">
                {QR_TYPES.map(({ type, icon, label }) => (
                  <button
                    key={type}
                    className={`qr-type-chip ${activeType === type ? 'qr-type-chip--active' : ''}`}
                    onClick={() => handleTypeChange(type)}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>

              {/* Title */}
              <div className="field">
                <label>QR Code title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={`My ${QR_TYPE_LABELS[activeType]}`}
                />
                <p className="field__hint">For your reference — not shown in QR code</p>
              </div>

              {/* Content form */}
              <ContentForm
                type={activeType}
                value={content}
                onChange={handleContentChange}
              />

              {/* Platform chip */}
              {activeType === 'url' && detectedPlatform && (
                <div
                  className="platform-chip"
                  style={{background: detectedPlatform.color, marginBottom: 12}}
                >
                  <span style={{fontSize: '1rem'}}>{detectedPlatform.icon_emoji}</span>
                  <span>Platform detected: {detectedPlatform.name}</span>
                  {appliedTheme && <span style={{opacity: 0.8, fontSize: '0.75rem'}}>— theme applied</span>}
                  <button
                    onClick={clearTheme}
                    style={{background: 'rgba(255,255,255,0.25)',
                      border: 'none',
                      borderRadius: 4,
                      color: 'white',
                      cursor: 'pointer',
                      padding: '2px 8px',
                      marginLeft: 'auto',
                      fontSize: '0.8rem',}}
                  >
                    ✕ Reset
                  </button>
                </div>
              )}

              {/* Logo section */}
              <div className="field" style={{marginBottom: 16}}>
                <label style={{display: 'flex', alignItems: 'center', gap: 8}}>
                  🖼 Logo in QR center
                  {!isPro && <span className="pro-badge">PRO</span>}
                </label>
                <ProGate feature="logo_upload" isPro={isPro} onUpgradeClick={() => setShowUpgradeModal(true)}>
                  <div
                    onDragOver={e => { e.preventDefault(); }}
                    onDrop={handleLogoDrop}
                    onClick={() => logoInputRef.current?.click()}
                    style={{border: '2px dashed var(--border)',
                      borderRadius: 10,
                      padding: '16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      color: 'var(--text-2)',}}
                  >
                    {style.logo_b64 ? (
                      <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                        <img
                          src={`data:image/png;base64,${style.logo_b64}`}
                          alt="Logo"
                          style={{width: 48, height: 48, objectFit: 'contain', borderRadius: 6}}
                        />
                        <span>Logo loaded</span>
                        <button
                          onClick={e => { e.stopPropagation(); handleStyleChange('logo_b64', ''); }}
                          style={{marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)'}}
                        >✕ Remove</button>
                      </div>
                    ) : (
                      <span>📂 Drop logo here or click to upload<br /><small>PNG, JPG, SVG · max 2MB</small></span>
                    )}
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                    style={{display: 'none'}}
                    onChange={handleLogoFileChange}
                  />
                </ProGate>
              </div>

              {/* Design section */}
              <details style={{ marginBottom: 20 }}>
                <summary style={{
                  cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem',
                  color: 'var(--text-2)', padding: '8px 0', listStyle: 'none',
                  display: 'flex', alignItems: 'center', gap: 6
                }}>
                  🎨 Customize colors & style
                </summary>
                <div style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="field__row">
                    <div className="field">
                      <label>QR Color</label>
                      <div className="color-row">
                        <div className="color-swatch" style={{ background: style.foreground }}>
                          <input type="color" value={style.foreground}
                            onChange={e => handleStyleChange('foreground', e.target.value)} />
                        </div>
                        <input type="text" value={style.foreground}
                          onChange={e => handleStyleChange('foreground', e.target.value)}
                          style={{ flex: 1 }} />
                      </div>
                    </div>
                    <div className="field">
                      <label>Background</label>
                      <div className="color-row">
                        <div className="color-swatch" style={{ background: style.background,
                          border: '1.5px solid var(--border)' }}>
                          <input type="color" value={style.background}
                            onChange={e => handleStyleChange('background', e.target.value)} />
                        </div>
                        <input type="text" value={style.background}
                          onChange={e => handleStyleChange('background', e.target.value)}
                          style={{ flex: 1 }} />
                      </div>
                    </div>
                  </div>

                  <div className="field__row">
                    <div className="field">
                      <label>Error correction</label>
                      <select value={style.error_correct}
                        onChange={e => handleStyleChange('error_correct', e.target.value)}>
                        <option value="L">Low (7%)</option>
                        <option value="M">Medium (15%)</option>
                        <option value="Q">Quartile (25%)</option>
                        <option value="H">High (30%)</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Border size</label>
                      <input type="number" min={0} max={10} value={style.border}
                        onChange={e => handleStyleChange('border', parseInt(e.target.value))} />
                    </div>
                  </div>

                  {/* Corner style */}
                  <div className="field">
                    <label>Corner style</label>
                    <select
                      value={style.corner_style ?? 'square'}
                      onChange={e => handleStyleChange('corner_style', e.target.value)}
                    >
                      <option value="square">Square</option>
                      <option value="rounded">Rounded</option>
                      <option value="extra_rounded">Extra Rounded</option>
                    </select>
                  </div>

                  {/* Gradient second color */}
                  <div className="field">
                    <label style={{display: 'flex', alignItems: 'center', gap: 8}}>
                      Gradient color
                      <input
                        type="checkbox"
                        checked={!!style.fg_color_2}
                        onChange={e => {
                          if (!e.target.checked) {
                            handleStyleChange('fg_color_2', '');
                          } else {
                            handleStyleChange('fg_color_2', style.foreground);
                          }
                        }}
                        style={{marginLeft: 4}}
                      />
                    </label>
                    {style.fg_color_2 && (
                      <div className="color-row">
                        <div className="color-swatch" style={{ background: style.fg_color_2 }}>
                          <input type="color" value={style.fg_color_2}
                            onChange={e => handleStyleChange('fg_color_2', e.target.value)} />
                        </div>
                        <input type="text" value={style.fg_color_2}
                          onChange={e => handleStyleChange('fg_color_2', e.target.value)}
                          style={{ flex: 1 }} />
                      </div>
                    )}
                  </div>
                </div>
              </details>

              {/* Color presets */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {[
                  { fg: '#1D59F9', bg: '#FFFFFF', label: 'Blue' },
                  { fg: '#000000', bg: '#FFFFFF', label: 'Black' },
                  { fg: '#16A34A', bg: '#FFFFFF', label: 'Green' },
                  { fg: '#DC2626', bg: '#FFFFFF', label: 'Red' },
                  { fg: '#7C3AED', bg: '#FFFFFF', label: 'Purple' },
                  { fg: '#FFFFFF', bg: '#1D59F9', label: 'Inv.' },
                ].map(preset => (
                  <button
                    key={preset.label}
                    title={preset.label}
                    onClick={() => {
                      const newStyle = { ...style, foreground: preset.fg, background: preset.bg };
                      setStyle(newStyle);
                      if (content) triggerPreview(activeType, content, newStyle);
                    }}
                    style={{
                      width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
                      border: '2px solid var(--border)',
                      background: `linear-gradient(135deg, ${preset.fg} 50%, ${preset.bg} 50%)`,
                    }}
                  />
                ))}
              </div>

            </div>{/* END studio__left */}

            {/* CENTRE PANEL */}
            <div className="studio__center">
              <div style={{textAlign: 'center', width: '100%', maxWidth: 400}}>
                <p style={{fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-2)',
                  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16}}>
                  Live Preview
                </p>
                <div className="qr-preview" style={{width: 280, height: 280, margin: '0 auto 20px'}}>
                  {generating ? (
                    <span className="spinner spinner--brand" />
                  ) : previewB64 ? (
                    <img src={`data:image/png;base64,${previewB64}`} alt="QR preview" />
                  ) : (
                    <div className="qr-preview--placeholder">
                      <QrCode size={40} style={{opacity: 0.2, margin: '0 auto 8px'}} />
                      <p>Enter content to<br />generate QR code</p>
                    </div>
                  )}
                </div>
                {detectedPlatform && (
                  <div
                    className="platform-chip"
                    style={{background: detectedPlatform.color, marginBottom: 12, justifyContent: 'center'}}
                  >
                    <span>{detectedPlatform.icon_emoji}</span>
                    <span>{detectedPlatform.name}</span>
                  </div>
                )}
                {previewB64 && (
                  <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
                    <button className="btn btn--primary btn--full" onClick={downloadPreview}>
                      <Download size={16} /> Download PNG
                    </button>
                    <button className="btn btn--secondary btn--full" onClick={handleSave} disabled={saving}>
                      {saving ? <><span className="spinner" /> Saving...</> : <><Save size={16} /> Save to account</>}
                    </button>
                  </div>
                )}
                {error && <div className="error" style={{marginTop: 12}}>⚠ {error}</div>}
              </div>
            </div>{/* END studio__center */}

            {/* RIGHT PANEL */}
            <div className="studio__right">
              <div>
                <p style={{fontWeight: 700, fontSize: '0.9rem', marginBottom: 16, color: 'var(--text-1)'}}>
                  🎨 Design Presets
                </p>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
                  {PRESET_THEMES.map(preset => (
                    <div
                      key={preset.platform_id}
                      className={`preset-card ${!isPro ? 'preset-card--locked' : ''}`}
                      style={{background: preset.fg_color, color: 'white'}}
                      onClick={() => handleApplyPreset(preset)}
                      title={preset.description}
                    >
                      {!isPro && <div className="preset-card__lock">🔒 PRO</div>}
                      <div style={{fontSize: '1.5rem', marginBottom: 4}}>{PRESET_EMOJIS[preset.platform_id] || '🌐'}</div>
                      <div style={{fontSize: '0.8rem', fontWeight: 700}}>{preset.name}</div>
                      <div style={{fontSize: '0.7rem', opacity: 0.8, marginTop: 2}}>APPLY</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>{/* END studio__right */}

          </div>{/* END studio */}
        </div>
      </section>

      {/* ── Upgrade modal ────────────────────────────────────────── */}
      {showUpgradeModal && (
        <UpgradeModal
          onClose={() => setShowUpgradeModal(false)}
          onUpgraded={() => setIsPro(true)}
        />
      )}

      {/* ── Features ─────────────────────────────────────────────── */}
      <section className="container" style={{ padding: '0 24px 60px' }} id="features">
        <div className="section-header">
          <p className="section-label">Why QRify</p>
          <h2 className="section-title">Everything you need</h2>
          <p className="section-desc">
            Professional QR codes with custom colors, error correction, and instant download.
          </p>
        </div>

        <div className="features">
          {[
            { icon: <Zap size={20}/>,    title: 'Instant generation',  desc: 'QR code appears as you type. No button click needed.' },
            { icon: <QrCode size={20}/>, title: '9 QR types',          desc: 'URL, WiFi, Contact, Location, YouTube, SMS, Email and more.' },
            { icon: <Shield size={20}/>, title: 'High error correction',desc: 'Up to 30% of the code can be damaged and still scan.' },
            { icon: <Download size={20}/>, title: 'PNG + SVG export',  desc: 'PNG for web and print, SVG for infinite scaling.' },
            { icon: <User size={20}/>,   title: 'Save to dashboard',   desc: 'Create an account to save and manage all your QR codes.' },
            { icon: <Globe size={20}/>,  title: '100% free & local',   desc: 'No tracking, no cloud, no API keys. Runs on your machine.' },
          ].map(f => (
            <div key={f.title} className="feature-card">
              <div className="feature-card__icon">{f.icon}</div>
              <h3 className="feature-card__title">{f.title}</h3>
              <p className="feature-card__desc">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Stats bar */}
        <div className="stats-bar">
          {[
            { value: '9+',    label: 'QR Types' },
            { value: 'PNG + SVG', label: 'Export formats' },
            { value: '30%',   label: 'Error correction' },
            { value: '100%',  label: 'Free & local' },
          ].map(s => (
            <div key={s.label} className="stat">
              <div className="stat__value">{s.value}</div>
              <div className="stat__label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
