import type {
  QRCode, AuthResponse, User, QRType, QRStyle,
  Platform, SocialProfile, SocialLink, DynamicQR,
  PlatformDetection, QRTheme, DynamicAnalytics,
} from '@/types';

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

// ── Platforms ───────────────────────────────────────────────────────
export async function listPlatforms(): Promise<Platform[]> {
  const r = await fetch(`${BASE}/platforms`);
  return json<Platform[]>(r);
}

// ── Social QR ───────────────────────────────────────────────────────
export async function generateSocialQR(req: {
  platform_id:      string;
  username_or_url:  string;
  title:            string;
  style:            QRStyle;
  save?:            boolean;
}): Promise<{ image_b64: string; platform_url: string }> {
  const r = await fetch(`${BASE}/qr/social`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(req),
  });
  return json<{ image_b64: string; platform_url: string }>(r);
}

// ── Social Profile CRUD ─────────────────────────────────────────────
export async function createProfile(data: {
  name:        string;
  username:    string;
  bio?:        string;
  avatar_url?: string;
  theme_color: string;
  bg_color:    string;
  links:       SocialLink[];
}): Promise<SocialProfile> {
  const r = await fetch(`${BASE}/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  return json<SocialProfile>(r);
}

export async function listProfiles(): Promise<SocialProfile[]> {
  const r = await fetch(`${BASE}/profiles`, { headers: authHeaders() });
  return json<SocialProfile[]>(r);
}

export async function getProfile(id: string): Promise<SocialProfile> {
  const r = await fetch(`${BASE}/profile/${id}`, { headers: authHeaders() });
  return json<SocialProfile>(r);
}

export async function updateProfile(
  id: string,
  data: Partial<Pick<SocialProfile, 'name' | 'username' | 'bio' | 'avatar_url' | 'theme_color' | 'bg_color' | 'links'>>
): Promise<SocialProfile> {
  const r = await fetch(`${BASE}/profile/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  return json<SocialProfile>(r);
}

export async function deleteProfile(id: string): Promise<void> {
  await fetch(`${BASE}/profile/${id}`, { method: 'DELETE', headers: authHeaders() });
}

// ── Dynamic QR CRUD ─────────────────────────────────────────────────
export async function createDynamicQR(data: {
  title:           string;
  destination_url: string;
  expires_at?:     string;
  password?:       string;
}): Promise<DynamicQR> {
  const r = await fetch(`${BASE}/dynamic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  return json<DynamicQR>(r);
}

export async function listDynamicQRs(): Promise<DynamicQR[]> {
  const r = await fetch(`${BASE}/dynamic`, { headers: authHeaders() });
  return json<DynamicQR[]>(r);
}

export async function updateDynamicQR(
  id: string,
  data: { destination_url?: string; expires_at?: string; is_active?: boolean }
): Promise<DynamicQR> {
  const r = await fetch(`${BASE}/dynamic/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  return json<DynamicQR>(r);
}

export async function deleteDynamicQR(id: string): Promise<void> {
  await fetch(`${BASE}/dynamic/${id}`, { method: 'DELETE', headers: authHeaders() });
}

// ── Platform detection ──────────────────────────────────────────────
export async function detectPlatform(url: string): Promise<{ platform: PlatformDetection | null }> {
  const r = await fetch(`${BASE}/detect-platform`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  return json<{ platform: PlatformDetection | null }>(r);
}

export async function getTheme(platformId: string): Promise<QRTheme | null> {
  const r = await fetch(`${BASE}/themes/${platformId}`);
  if (!r.ok) return null;
  return r.json();
}

export async function listThemes(): Promise<QRTheme[]> {
  const r = await fetch(`${BASE}/themes`);
  return json<QRTheme[]>(r);
}

export async function fetchLogo(url: string): Promise<{
  favicon_b64: string | null;
  og_image_b64: string | null;
  source: string;
}> {
  const r = await fetch(`${BASE}/logo/fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ url }),
  });
  return json(r);
}

export async function upgradePlan(plan = 'pro'): Promise<{ id: string; plan: string; message: string }> {
  const r = await fetch(`${BASE}/auth/upgrade?plan=${plan}`, {
    method: 'PUT',
    headers: authHeaders(),
  });
  return json(r);
}

export async function getDynamicAnalytics(id: string, days = 30): Promise<DynamicAnalytics> {
  const r = await fetch(`${BASE}/dynamic/${id}/analytics?days=${days}`, { headers: authHeaders() });
  return json<DynamicAnalytics>(r);
}
