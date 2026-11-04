import { NavLink, useNavigate } from 'react-router-dom';
import { QrCode } from 'lucide-react';
import { getUser, clearToken } from '@/services/api';

export default function Navbar() {
  const navigate = useNavigate();
  const user = getUser();

  function logout() {
    clearToken();
    navigate('/');
    window.location.reload();
  }

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <NavLink to="/" className="navbar__logo">
          <QrCode size={22} />
          QRify<span className="navbar__logo-dot">.</span>
        </NavLink>

        <nav>
          <ul className="navbar__links">
            <li><NavLink to="/">Create</NavLink></li>
            {user && <li><NavLink to="/dashboard">My QR Codes</NavLink></li>}
            <li><a href="#features">Features</a></li>
          </ul>
        </nav>

        <div className="navbar__actions">
          {user ? (
            <>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-2)' }}>
                Hi, {user.name.split(' ')[0]}
              </span>
              <button className="btn btn--secondary btn--sm" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="btn btn--ghost btn--sm">Log in</NavLink>
              <NavLink to="/register" className="btn btn--primary btn--sm">Sign up free</NavLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
