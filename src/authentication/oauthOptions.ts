export interface IOauthOptions {
  /**
   * Is used to set the prompt parameter in the authorization request.
   * By setting this parameter to none, the user will not be prompted to
   * login, but instead be redirected back to the redirectUri with an error.
   *
   * This can be used to check if a user is already logged in or not.
   *
   * Defaults to 'login'.
  */
  prompt?: 'none' | 'login' | 'consent' | 'select_account';

  /**
   * Is used to set the nonce parameter.
  */
  nonce?: string;
  display?: 'page' | 'popup' | 'touch' | 'wap';

  /**
   * The max_age parameter is used to set the maximum age of the authentication
   * session in seconds. If the user has been authenticated for longer than this
   * time, the user will be prompted to login again.
  */
  max_age?: number;
  ui_locales?: string;
  id_token_hint?: string;

  /**
   * The login_hint parameter is used to pre-fill the username field in the login form.
   * This can be used to make the login process easier for the user.
  */
  login_hint?: string;
  acr_values?: string;
}

