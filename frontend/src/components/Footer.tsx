import { QrCode } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div>
            <div className="footer__brand" style={{ display:'flex', alignItems:'center', gap:8 }}>
              <QrCode size={20} /> QRify
            </div>
            <p className="footer__desc">
              Free QR code generator. Create custom QR codes for URLs, WiFi, contacts, and more.
              No sign-up required for basic use.
            </p>
          </div>
          <div>
            <p className="footer__heading">Product</p>
            <ul className="footer__links">
              <li><a href="/">Create QR</a></li>
              <li><a href="/dashboard">My Codes</a></li>
            </ul>
          </div>
          <div>
            <p className="footer__heading">QR Types</p>
            <ul className="footer__links">
              <li><a href="/">Website URL</a></li>
              <li><a href="/">WiFi</a></li>
              <li><a href="/">Contact Card</a></li>
              <li><a href="/">Location</a></li>
            </ul>
          </div>
          <div>
            <p className="footer__heading">Stack</p>
            <ul className="footer__links">
              <li><span style={{color:'var(--text-3)'}}>React 19 + Vite</span></li>
              <li><span style={{color:'var(--text-3)'}}>FastAPI + MongoDB</span></li>
              <li><span style={{color:'var(--text-3)'}}>Python qrcode lib</span></li>
              <li><span style={{color:'var(--text-3)'}}>100% Local</span></li>
            </ul>
          </div>
        </div>
        <div className="footer__bar">
          <span>© 2026 QRify — Built with Incantum_REA + Kiro AI</span>
          <span>MIT License · Local first · No tracking</span>
        </div>
      </div>
    </footer>
  );
}
