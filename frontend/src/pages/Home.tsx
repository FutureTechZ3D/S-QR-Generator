import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  QrCode, Globe, FileText, Mail, Phone, MessageSquare,
  Wifi, User, MapPin, Youtube, Shield, Zap, Download, Save
} from 'lucide-react';
import { previewQR, createQR, getToken } from '@/services/api';
import type { QRType, QRStyle } from '@/types';
import { QR_TYPE_LABELS, DEFAULT_STYLE } from '@/types';

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

  function handleContentChange(v: string) {
    setContent(v);
    triggerPreview(activeType, v, style);
  }

  function handleStyleChange(key: keyof QRStyle, value: string | number) {
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

          {/* ── QR Type selector ──────────────────────────────────── */}
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

          {/* ── Generator ─────────────────────────────────────────── */}
          <div className="generator">
            {/* Left: Form */}
            <div className="generator__form">
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

              <ContentForm
                type={activeType}
                value={content}
                onChange={handleContentChange}
              />

              {/* Style customization */}
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

              {error && <div className="error" style={{ marginBottom: 14 }}>⚠ {error}</div>}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn--secondary"
                  style={{ flex: 1 }}
                  onClick={downloadPreview}
                  disabled={!previewB64}
                >
                  <Download size={16} /> Download PNG
                </button>
                <button
                  className="btn btn--primary"
                  style={{ flex: 1 }}
                  onClick={handleSave}
                  disabled={saving || !content.trim() || !title.trim()}
                >
                  {saving
                    ? <><span className="spinner" /> Saving...</>
                    : <><Save size={16} /> Save to account</>
                  }
                </button>
              </div>
            </div>

            {/* Right: Preview */}
            <div className="generator__preview">
              <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-2)',
                textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Live Preview
              </p>

              <div className="qr-preview">
                {generating ? (
                  <span className="spinner spinner--brand" />
                ) : previewB64 ? (
                  <img src={`data:image/png;base64,${previewB64}`} alt="QR preview" />
                ) : (
                  <div className="qr-preview--placeholder">
                    <QrCode size={40} style={{ opacity: 0.2, margin: '0 auto 8px' }} />
                    <p>Enter content to<br />generate QR code</p>
                  </div>
                )}
              </div>

              {previewB64 && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button className="btn btn--primary btn--full" onClick={downloadPreview}>
                    <Download size={16} /> Download PNG
                  </button>
                  <button className="btn btn--secondary btn--full" onClick={handleSave}>
                    <Save size={16} /> Save to account
                  </button>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', textAlign: 'center' }}>
                    High-resolution · Transparent background · SVG also available
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

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
