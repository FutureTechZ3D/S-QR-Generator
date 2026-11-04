import type { QRCode, AuthResponse, User, QRType, QRStyle } from '@/types';

const BASE = '/api';

// ── Auth token helpers ──────────────────────────────────────────────
export function getToken(): string | null {
  return localStorage.getItem('qr_token');
}
export function setToken(t: string) {
  localStorage.setItem('qr_token', t);
}
export function clearToken() {
  localStorage.removeItem('qr_token');
  localStorage.removeItem('qr_user');
}
export function getUser(): User | null {
  try {
    const u = localStorage.getItem('qr_user');
    return u ? JSON.parse(u) : null;
  } catch { return null; }
}
export function setUser(u: User) {
  localStorage.setItem('qr_user', JSON.stringify(u));
}

function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as { detail?: string }).detail ?? 'Request failed');
  }
  return res.json();
}

// ── Auth ────────────────────────────────────────────────────────────
export async function register(
  name: string, email: string, password: string
): Promise<AuthResponse> {
  const r = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await json<AuthResponse>(r);
  setToken(data.access_token);
  setUser(data.user);
  return data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await json<AuthResponse>(r);
  setToken(data.access_token);
  setUser(data.user);
  return data;
}

export async function fetchMe(): Promise<User> {
  const r = await fetch(`${BASE}/auth/me`, { headers: authHeaders() });
  return json<User>(r);
}

// ── QR — Preview (no auth) ──────────────────────────────────────────
export async function previewQR(
  qr_type: QRType,
  title: string,
  content: string,
  style: QRStyle
): Promise<{ image_b64: string }> {
  const r = await fetch(`${BASE}/qr/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ title, qr_type, content, style }),
  });
  return json(r);
}

// ── QR — CRUD (requires auth) ───────────────────────────────────────
export async function createQR(
  qr_type: QRType,
  title: string,
  content: string,
  style: QRStyle
): Promise<QRCode> {
  const r = await fetch(`${BASE}/qr/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ title, qr_type, content, style }),
  });
  return json<QRCode>(r);
}

export async function listQRCodes(): Promise<QRCode[]> {
  const r = await fetch(`${BASE}/qr/`, { headers: authHeaders() });
  return json<QRCode[]>(r);
}

export async function getQRCode(id: string): Promise<QRCode> {
  const r = await fetch(`${BASE}/qr/${id}`, { headers: authHeaders() });
  return json<QRCode>(r);
}

export async function deleteQRCode(id: string): Promise<void> {
  await fetch(`${BASE}/qr/${id}`, { method: 'DELETE', headers: authHeaders() });
}

export function downloadUrl(id: string, fmt: 'image' | 'svg'): string {
  return `${BASE}/qr/${id}/${fmt}`;
}
