import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Download, Trash2, QrCode } from 'lucide-react';
import { listQRCodes, deleteQRCode, getToken, downloadUrl } from '@/services/api';
import type { QRCode } from '@/types';
import { QR_TYPE_LABELS, QR_TYPE_ICONS } from '@/types';

export default function Dashboard() {
  const navigate = useNavigate();
  const [codes, setCodes]   = useState<QRCode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { navigate('/login'); return; }
    listQRCodes()
      .then(c => { setCodes(c); setLoading(false); })
      .catch(() => { navigate('/login'); });
  }, [navigate]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this QR code?')) return;
    await deleteQRCode(id);
    setCodes(c => c.filter(q => q.id !== id));
  }

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
        <span className="spinner spinner--brand" />
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '32px 24px' }}>
      <div className="dashboard__header">
        <h1 className="dashboard__title">📱 My QR Codes</h1>
        <Link to="/" className="btn btn--primary">
          <Plus size={16} /> Create New
        </Link>
      </div>

      {codes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon"><QrCode size={48} /></div>
          <p style={{ fontSize: '1rem', marginBottom: 20 }}>
            No QR codes yet. Create your first one!
          </p>
          <Link to="/" className="btn btn--primary btn--lg">Create QR Code</Link>
        </div>
      ) : (
        <div className="qr-grid">
          {codes.map(qr => (
            <div key={qr.id} className="qr-card">
              {qr.image_b64 ? (
                <img
                  src={`data:image/png;base64,${qr.image_b64}`}
                  alt={qr.title}
                />
              ) : (
                <div style={{
                  width: 140, height: 140,
                  background: 'var(--bg-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 8, fontSize: '2rem'
                }}>
                  {QR_TYPE_ICONS[qr.qr_type]}
                </div>
              )}
              <div className="qr-card__title">{qr.title}</div>
              <span className="qr-card__type">
                {QR_TYPE_ICONS[qr.qr_type]} {QR_TYPE_LABELS[qr.qr_type]}
              </span>
              <div className="qr-card__actions">
                <a
                  href={downloadUrl(qr.id, 'image')}
                  download={`${qr.title}.png`}
                  className="btn btn--secondary btn--sm"
                  title="Download PNG"
                >
                  <Download size={13} /> PNG
                </a>
                <a
                  href={downloadUrl(qr.id, 'svg')}
                  download={`${qr.title}.svg`}
                  className="btn btn--secondary btn--sm"
                  title="Download SVG"
                >
                  <Download size={13} /> SVG
                </a>
                <button
                  className="btn btn--danger btn--sm"
                  onClick={() => handleDelete(qr.id)}
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
                {qr.scans} scans · {new Date(qr.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
