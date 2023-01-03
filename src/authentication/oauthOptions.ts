export interface IOauthOptions {
  prompt?: 'none' | 'login' | 'consent' | 'select_account';
  nonce?: string;
  display?: 'page' | 'popup' | 'touch' | 'wap';
  max_age?: number;
  ui_locales?: string;
  id_token_hint?: string;
  login_hint?: string;
  acr_values?: string;
}

