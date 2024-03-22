import { AuthorizationError, AuthorizationResponse, BaseTokenRequestHandler, BasicQueryStringUtils, DefaultCrypto, FetchRequestor, LocalStorageBackend, RevokeTokenRequest, TokenTypeHint } from "@openid/appauth";
import { GRANT_TYPE_AUTHORIZATION_CODE, GRANT_TYPE_REFRESH_TOKEN, TokenRequest } from "@openid/appauth/built/token_request";

import { AuthorizationRequest } from "@openid/appauth/built/authorization_request";
import { AuthorizationRequestResponse } from "@openid/appauth/built/authorization_request_handler";
import { AuthorizationServiceConfiguration } from "@openid/appauth/built/authorization_service_configuration";
import { IAuthenticationOptions } from "./authenticationOptions";
import { IOauthOptions } from "./oauthOptions";
import { RedirectRequestHandler } from "@openid/appauth/built/redirect_based_handler";
import { TokenResponse } from "@openid/appauth/built/token_response";
import { TokenStore } from "./tokenStore";

class CustomFetchRequestor {
    private requestor: FetchRequestor;

    constructor() {
        this.requestor = new FetchRequestor();
    }

    public xhr<T>(settings: JQueryAjaxSettings): Promise<T> {
        settings.xhrFields = {
            withCredentials: true
        };
        return this.requestor.xhr(settings);
    }
}

export class AuthenticationContext {
    private accessTokenResponse: TokenResponse | undefined;
    private configuration: AuthorizationServiceConfiguration;
    private authorizationHandler: AuthorizationHandler;
    private tokenHandler: BaseTokenRequestHandler;
    private loginUrl = 'https://login.elfsquad.io'
    private fetchRequestor: CustomFetchRequestor;

    private onSignInResolvers: any[] = [];
    private onSignInRejectors: any[] = [];
    private signedInResolvers: any[] = [];

    private isInitialized = false;

    private state: string;


    /**
     * Creates an instance of AuthenticationContext & initializes with the provided authentication options.
     *
     * @example
     * ```typescript
     * const authenticationContext = new AuthenticationContext({
     *   clientId: 'your-client-id',
     *   redirectUri: 'https://example.com',
     *   scope: 'Elfskot.Api offline_access',
     *   responseMode: 'fragment',
     *   loginUrl: 'https://login.elfsquad.io'
     * });
     * ```
     */
    constructor(private options: IAuthenticationOptions) {
        if (!options) { console.error('No authentication options were provided'); return; }
        if (!options.clientId) { console.error('No client id provided'); return; }
        if (!options.redirectUri) { console.error('No redirect uri provided'); return; }
        if (!options.scope) { options.scope = 'Elfskot.Api offline_access'; }
        if (!options.responseMode) { options.responseMode = 'fragment'; }
        if (options.loginUrl) { this.loginUrl = options.loginUrl; }

        this.fetchRequestor = new CustomFetchRequestor();
        this.tokenHandler = new BaseTokenRequestHandler(this.fetchRequestor);
        this.authorizationHandler = new AuthorizationHandler(options.responseMode);
        this.initialize();
    }

    /**
     * This method can be used for executing logic after the user has
     * signed in. For example, you can use this method to fetch & set
     * the access token, change the UI, etc.
     *
     * @example
     * ```typescript
     * const authenticationContext = new AuthenticationContext();
     * async function onSignIn() {
     *   console.log('User has signed in');
     * };
     * authenticationContext.onSignIn().then(onSignIn);
     * ```
     *
     * @returns promise that resolves when the user has signed in. If
     * the user is already signed in, the promise resolves immediately.
     */
    public onSignIn(): Promise<void> {
        // If the user is already authetnicated, resolve immediately
        if (this.validateAccessTokenResponse()) {
            return Promise.resolve();
        }

        let promise = new Promise<void>((resolve, reject) => {
            this.onSignInResolvers.push(resolve);
            this.onSignInRejectors.push(reject);
        });
        return promise;
    }

    /**
     * This method starts the login flow & redirects the user to the login page.
     *
     * @example
     * ```typescript
     * const authenticationContext = new AuthenticationContext();
     * authenticationContext.signIn();
     * ```
     *
     * @param options - oauth options that will be passed on to the
     * authorization request. This can be used, for example, to perform
     * a silent login.
     */
    public async signIn(options: IOauthOptions = null): Promise<void> {
        await this.fetchConfiguration();
        this.makeAuthorizationRequest(options);
    }

    /**
     * This method signs the user out & revokes the tokens. After signing out, the user will be redirected to the postLogoutRedirectUri.
     * If no postLogoutRedirectUri is provided, the user will be redirected to the login page.
     *
     * @example
     * ```typescript
     * const authenticationContext = new AuthenticationContext();
     * const postLogoutRedirectUri = 'https://example.com';
     * authenticationContext.signOut(postLogoutRedirectUri);
     * ```
     *
     * @param postLogoutRedirectUri - the uri where the user will be redirected to after signing out.
     */
    public async signOut(postLogoutRedirectUri: string | null = null) {
        const idTokenHint = await this.getIdToken();
        this.revokeTokens()
            .then(async () => {
                await this.endSession(postLogoutRedirectUri, idTokenHint);
                this.deleteTokens();
            });
    }

    private deleteTokens() {
        this.accessTokenResponse = null;
        TokenStore.deleteRefreshToken();
        TokenStore.deleteTokenResponse();
    }

    private revokeTokens(): Promise<any> {
        return Promise.all([
          this.revokeRefreshToken(),
          this.revokeAccessToken(),
        ]);
    }

    private revokeRefreshToken(): Promise<any> {
        if (!TokenStore.hasRefreshToken()) {
          return Promise.resolve();
        }
        return this.revokeToken(TokenStore.getRefreshToken(), 'refresh_token');
    }

    private revokeAccessToken(): Promise<any> {
        if (!TokenStore.hasTokenResponse()) {
          return Promise.resolve();
        }
        return this.revokeToken(TokenStore.getTokenResponse().accessToken, 'access_token');
    }

    private async revokeToken(token: string, tokenType: TokenTypeHint) {
        const request = new RevokeTokenRequest({
            token: token,
            token_type_hint: tokenType,
            client_id: this.options.clientId
        });

        const response = await this.tokenHandler.performRevokeTokenRequest(this.configuration, request);
        if (!response) {
            console.error(`Revoke token request for token '${tokenType}' failed`);
        }
    }

    private async endSession(postLogoutRedirectUri: string | null, idTokenHint: string | null): Promise<void> {
        const url = new URL(this.configuration.endSessionEndpoint);
        if (postLogoutRedirectUri) {
            url.searchParams.append("post_logout_redirect_uri", postLogoutRedirectUri);
        }
        if (idTokenHint) {
            url.searchParams.append("id_token_hint", idTokenHint);
        }
        window.location.href = url.toString();
    }

    /**
     * This method can be used to check if the user is signed in, for example to show a login/logout button.
     *
     * @example
     * ```typescript
     * const authenticationContext = new AuthenticationContext();
     * async function isSignedIn(value: boolean) {
     *   console.log('User is signed in:', value);
     * }
     * authenticationContext.isSignedIn().then(isSignedIn);
     * ```
     *
     * @returns promise that resolves with a boolean indicating if the user is signed in.
     */
    public isSignedIn(): Promise<boolean> {
        let promise = new Promise<boolean>((resolve, _) => {
            if (this.isInitialized) {
                resolve(this.validateAccessTokenResponse());
                return;
            }

            this.signedInResolvers.push(resolve);
        });

        return promise;
    }

    private _refreshTokenPromise: Promise<string> = null;
    /**
     * This method can be used to get the access token. This method will
     * automatically refresh the access token if it has expired and a
     * valid refresh token is available.
     *
     * @example
     * ```typescript
     * const authenticationContext = new AuthenticationContext();
     * authenticationContext.getAccessToken().then(accessToken => {
     *   console.log('Access token:', accessToken);
     * });
     * ```
     *
     * @returns promise that resolves with the access token.
     */
    public async getAccessToken(): Promise<string> {
        await this.waitFor(() => this.isInitialized);

        if (this.validateAccessTokenResponse()) {
            return Promise.resolve(this.accessTokenResponse.accessToken);
        }

        if (!TokenStore.hasRefreshToken()) {
            return Promise.resolve(null);
        }

        if (this._refreshTokenPromise) {
            return this._refreshTokenPromise;
        }

        this._refreshTokenPromise = this.refreshAccessToken();
        let accessToken = await this._refreshTokenPromise;
        this._refreshTokenPromise = null;
        return accessToken;
    }

    /**
     * This method can be used to get the id token. Similar to the
     * getAccessToken method, this method will automatically refresh
     * the id (and access) token if it has expired and a valid refresh
     * token is available.
     *
     * @example
     * ```typescript
     * const authenticationContext = new AuthenticationContext();
     * authenticationContext.getIdToken().then(idToken => {
     *   console.log('Id token:', idToken);
     * });
     * ```
     * @returns promise that resolves with the id token.
     */
    public async getIdToken(): Promise<string> {
        if (!this.configuration) {
            console.error('@elfsquad/authentication: No service configuration found');
            return Promise.resolve(null);
        }

        if (this.validateAccessTokenResponse()) {
            return Promise.resolve(this.accessTokenResponse.idToken);
        }

        if (!TokenStore.hasRefreshToken()) {
            console.log('@elfsquad/authentication: No refresh token found');
            return Promise.resolve(null);
        }

        await this.refreshAccessToken();
        return Promise.resolve(this.accessTokenResponse.idToken);
    }

    /**
     * This method can be used to persist date in local storage, which
     * can be used to save data between sign in attempts. This can
     * be useful, for example, to save the url the current url before
     * the user is redirected to the login page.
     *
     * This method user the oauth2 state parameter, which means the data
     * is only persisted for one sign in attempt.
     *
     * @example
     * ```typescript
     * const authenticationContext = new AuthenticationContext();
     *
     * authenticationContext.setState({ url: window.location.href });
     * authenticationContext.onSignIn().then(() => {
     *   const { url } = authenticationContext.getState();
     *   window.location.href = url;
     * });
     *
     * authenticationContext.signIn();
     * ```
     *
     * @param data - the data that will be persisted in local storage.
     */
    public setState(data: any) {
      this.state = (Math.random() + 1).toString(36).substring(2);
      localStorage.setItem(`elfsquad-${this.state}`, JSON.stringify(data));
    }

    /**
     * This method can be used to retrieve data that was persisted in
     * local storage using the setState method.
     *
     * @example
     * ```typescript
     * const authenticationContext = new AuthenticationContext();
     *
     * authenticationContext.setState({ url: window.location.href });
     * authenticationContext.onSignIn().then(() => {
     *   const { url } = authenticationContext.getState();
     *   window.location.href = url;
     * });
     *
     * authenticationContext.signIn();
     * ```
     *
     * @returns the data that was persisted in local storage.
     */
    public getState(): any | null {
      const val = localStorage.getItem(`elfsquad-${this.state}`);
      if (val == null)
        return null;
      return JSON.parse(val);
    }

    private validateAccessTokenResponse(): boolean {
        // `accessTokenResponse.isValid` uses a default buffer of 10 min
        return !!this.accessTokenResponse && this.accessTokenResponse.isValid();
    }

    private async refreshAccessToken(): Promise<string> {
        if (!this.configuration) {
            return null;
        }

        const request = new TokenRequest({
            client_id: this.options.clientId,
            redirect_uri: this.options.redirectUri,
            grant_type: GRANT_TYPE_REFRESH_TOKEN,
            code: undefined,
            refresh_token: TokenStore.getRefreshToken(),
            extras: undefined
        });

        const response = await this.tokenHandler
            .performTokenRequest(this.configuration, request)

        this.accessTokenResponse = response;
        TokenStore.saveRefreshToken(response.refreshToken);
        TokenStore.saveTokenResponse(response);
        return response.accessToken;
    }

    private async fetchConfiguration(): Promise<void> {
        if (!!this.configuration) { return; }
        this.configuration = await AuthorizationServiceConfiguration.fetchFromIssuer(this.loginUrl, this.fetchRequestor);
    }

    private makeAuthorizationRequest(options: object) {
        const extras = { 'access_type': 'offline', 'response_mode': this.options.responseMode };
        // create a request
        const request = new AuthorizationRequest({
            client_id: this.options.clientId,
            redirect_uri: this.options.redirectUri,
            scope: this.options.scope,
            response_type: AuthorizationRequest.RESPONSE_TYPE_CODE,
            state: this.state,
            extras: { ...extras, ...options }
        });

        // make the authorization request
        this.authorizationHandler.performAuthorizationRequest(this.configuration, request);
    }

    private async onAuthorization(request: AuthorizationRequest, response: AuthorizationResponse, error: AuthorizationError): Promise<void> {
        const locationVariable = window.location.href;
        this.state = new RegExp('state=(.*?)(&|$)').exec(locationVariable)[1]

        location.hash = '';
        if (!!error) {
            for (let onSignInRejector of this.onSignInRejectors) {
                onSignInRejector(error);
            }
            return;
        }

        if (!response) { return; }

        let code = response.code;
        if (!code){
            code = this.options.responseMode == 'fragment'
                ? new RegExp('#code=(.*?)&').exec(locationVariable)[1]
                : new URL(location.href).searchParams.get('code');
        }

        let tokenRequest = new TokenRequest({
            client_id: this.options.clientId,
            redirect_uri: this.options.redirectUri,
            grant_type: GRANT_TYPE_AUTHORIZATION_CODE,
            code: code,
            refresh_token: undefined,
        });

        if (request.internal?.code_verifier) {
            tokenRequest.extras = { code_verifier: request.internal.code_verifier };
        }

        if (!this.configuration) {
            await this.fetchConfiguration();
        }

        this.accessTokenResponse = await this.tokenHandler
            .performTokenRequest(this.configuration, tokenRequest);
        TokenStore.saveRefreshToken(this.accessTokenResponse.refreshToken);
        TokenStore.saveTokenResponse(this.accessTokenResponse);
        this.callSignInResolvers();
    }

    private async initialize(): Promise<void> {
        await this.fetchConfiguration();

        if (TokenStore.hasTokenResponse()) {
            this.accessTokenResponse = TokenStore.getTokenResponse();
        }

        // If the access token is still valid, we do not need to refresh
        if (this.validateAccessTokenResponse()) {
            this.isInitialized = true;
            this.callSignInResolvers();
            this.callSignedInResolvers();
            return;
        }

        if (TokenStore.hasRefreshToken()) {
            await this.fetchConfiguration();
            this.refreshAccessToken()
                .then(() => {
                    this.callSignInResolvers();
                })
                .catch((e) => {
                    console.error('Failed to refresh access token', e);
                    this.deleteTokens();
                })
                .finally(() => {
                    this.isInitialized = true;
                    this.callSignedInResolvers();
                });

            return;
        }

        this.completeAuthorizationRequest();
    }

    private completeAuthorizationRequest(): void {
        this.authorizationHandler.completeAuthorizationRequest()
            .then(async (result) => {
                this.isInitialized = true;
                if (!!result) {
                    await this.onAuthorization(result.request, result.response, result.error);
                }
                this.callSignedInResolvers();
            });
    }

    private callSignedInResolvers(): void {
        for (let signedInResolver of this.signedInResolvers) {
            signedInResolver(this.validateAccessTokenResponse());
        }
    }

    private callSignInResolvers(): void {
        for (let onSignInResolver of this.onSignInResolvers) {
            onSignInResolver();
        }
    }

    private sleep(ms: number): Promise<void> {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async waitFor(f: () => boolean): Promise<void> {
      while(!f()) await this.sleep(200);
    }
}

class NoHashQueryStringUtils extends BasicQueryStringUtils {
    constructor(private responseMode: 'query' | 'fragment') { super(); }

    parse(input) {
      return super.parse(input, this.responseMode == 'fragment');
    }
  }

class AuthorizationHandler extends RedirectRequestHandler {
    constructor(responseMode: 'query' | 'fragment') {
        super(new LocalStorageBackend(), new NoHashQueryStringUtils(responseMode),  window.location, new DefaultCrypto());
    }

    public completeAuthorizationRequest(): Promise<AuthorizationRequestResponse | null> {
        return super.completeAuthorizationRequest();
    }
}
