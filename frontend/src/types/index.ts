export type QRType =
  | 'url' | 'text' | 'email' | 'phone' | 'sms'
  | 'wifi' | 'vcard' | 'location' | 'youtube'
  | 'pdf' | 'image' | 'app_store' | 'menu'
  | 'social' | 'social_profile' | 'dynamic';

export interface QRStyle {
  foreground:      string;
  background:      string;
  error_correct:   string;
  box_size:        number;
  border:          number;
  logo_url?:       string;
  corner_style?:   'square' | 'rounded' | 'extra_rounded';
  fg_color_2?:     string;
  logo_b64?:       string;
  logo_size?:      number;
  logo_padding?:   boolean;
  platform_id?:    string;
}

export interface SocialLink {
  platform_id: string;
  url:         string;
  title?:      string;
}

export interface Platform {
  id:                 string;
  name:               string;
  category:           string;
  url_template:       string;
  username_prefix:    string;
  icon_emoji:         string;
  color:              string;
  validation_pattern: string | null;
}

export interface SocialProfile {
  id:          string;
  user_id:     string;
  name:        string;
  username:    string;
  bio?:        string;
  avatar_url?: string;
  theme_color: string;
  bg_color:    string;
  links:       SocialLink[];
  visits:      number;
  slug:        string;
  created_at:  string;
  updated_at:  string;
}

export interface DynamicQR {
  id:             string;
  user_id:        string;
  title:          string;
  destination_url: string;
  redirect_url:   string;
  redirect_count: number;
  is_active:      boolean;
  expires_at?:    string;
  has_password:   boolean;
  created_at:     string;
  updated_at:     string;
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
  url:            'Website URL',
  text:           'Plain Text',
  email:          'Email',
  phone:          'Phone',
  sms:            'SMS',
  wifi:           'WiFi',
  vcard:          'Contact Card',
  location:       'Location',
  youtube:        'YouTube',
  pdf:            'PDF File',
  image:          'Image',
  app_store:      'App Store',
  menu:           'Menu / PDF',
  social:         'Social QR',
  social_profile: 'Social Profile',
  dynamic:        'Dynamic QR',
};

export const QR_TYPE_ICONS: Record<QRType, string> = {
  url:            '🌐',
  text:           '📝',
  email:          '✉️',
  phone:          '📞',
  sms:            '💬',
  wifi:           '📶',
  vcard:          '👤',
  location:       '📍',
  youtube:        '▶️',
  pdf:            '📄',
  image:          '🖼',
  app_store:      '📱',
  menu:           '🍽',
  social:         '📱',
  social_profile: '🔗',
  dynamic:        '⚡',
};

export const DEFAULT_STYLE: QRStyle = {
  foreground:    '#1D59F9',
  background:    '#FFFFFF',
  error_correct: 'H',
  box_size:      10,
  border:        4,
};

export interface PlatformDetection {
  id: string;
  name: string;
  icon_emoji: string;
  color: string;
  suggested_theme: string;
  category?: string;
}

export interface QRTheme {
  platform_id: string;
  name: string;
  fg_color: string;
  bg_color: string;
  fg_color_2: string;
  corner_style: 'square' | 'rounded' | 'extra_rounded';
  error_correct: string;
  description: string;
}

export interface NamedCount { name: string; count: number; }
export interface DynamicAnalytics {
  days:         number;
  total_scans:  number;
  period_scans: number;
  unique:       number;
  daily:        { date: string; count: number }[];
  devices:      NamedCount[];
  os:           NamedCount[];
  countries:    NamedCount[];
  referrers:    NamedCount[];
}
