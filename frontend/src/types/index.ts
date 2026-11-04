export type QRType =
  | 'url' | 'text' | 'email' | 'phone' | 'sms'
  | 'wifi' | 'vcard' | 'location' | 'youtube'
  | 'pdf' | 'image' | 'app_store' | 'menu';

export interface QRStyle {
  foreground:    string;
  background:    string;
  error_correct: string;
  box_size:      number;
  border:        number;
  logo_url?:     string;
}

export interface QRCode {
  id:          string;
  user_id?:    string;
  title:       string;
  qr_type:     QRType;
  content:     string;
  style:       QRStyle;
  image_path?: string;
  image_b64?:  string;
  scans:       number;
  created_at:  string;
  updated_at:  string;
}

export interface User {
  id:        string;
  name:      string;
  email:     string;
  plan:      'free' | 'pro' | 'business';
  qr_count:  number;
}

export interface AuthResponse {
  access_token: string;
  token_type:   string;
  user:         User;
}

export const QR_TYPE_LABELS: Record<QRType, string> = {
  url:       'Website URL',
  text:      'Plain Text',
  email:     'Email',
  phone:     'Phone',
  sms:       'SMS',
  wifi:      'WiFi',
  vcard:     'Contact Card',
  location:  'Location',
  youtube:   'YouTube',
  pdf:       'PDF File',
  image:     'Image',
  app_store: 'App Store',
  menu:      'Menu / PDF',
};

export const QR_TYPE_ICONS: Record<QRType, string> = {
  url:       '🌐',
  text:      '📝',
  email:     '✉️',
  phone:     '📞',
  sms:       '💬',
  wifi:      '📶',
  vcard:     '👤',
  location:  '📍',
  youtube:   '▶️',
  pdf:       '📄',
  image:     '🖼',
  app_store: '📱',
  menu:      '🍽',
};

export const DEFAULT_STYLE: QRStyle = {
  foreground:    '#1D59F9',
  background:    '#FFFFFF',
  error_correct: 'H',
  box_size:      10,
  border:        4,
};
