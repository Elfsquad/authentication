import { TokenResponse } from "@openid/appauth/built/token_response";
import { AuthorizationServiceConfiguration } from "@openid/appauth/built/authorization_service_configuration";
import { IOauthOptions } from "./oauthOptions";
import { IAuthenticationOptions } from "./authenticationOptions";
import { AuthorizationRequest } from "@openid/appauth/built/authorization_request";
import { AuthorizationRequestResponse } from "@openid/appauth/built/authorization_request_handler";
import { RedirectRequestHandler } from "@openid/appauth/built/redirect_based_handler";
import { GRANT_TYPE_AUTHORIZATION_CODE, GRANT_TYPE_REFRESH_TOKEN, TokenRequest } from "@openid/appauth/built/token_request";
import { AuthorizationError, AuthorizationResponse, BaseTokenRequestHandler, FetchRequestor, RevokeTokenRequest, TokenTypeHint } from "@openid/appauth";
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

    constructor(private options: IAuthenticationOptions) {
        if (!options) { console.error('No authentication options were provided'); return; }
        if (!options.clientId) { console.error('No client id provided'); return; }
        if (!options.redirectUri) { console.error('No redirect uri provided'); return; }
        if (!options.scope) { options.scope = 'Elfskot.Api offline_access'; }
        if (options.loginUrl) { this.loginUrl = options.loginUrl; }

        this.fetchRequestor = new CustomFetchRequestor();
        this.tokenHandler = new BaseTokenRequestHandler(this.fetchRequestor);
        this.authorizationHandler = new AuthorizationHandler();

        this.initialize();
    }

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

    public async signIn(options: IOauthOptions = null): Promise<void> {
        await this.fetchConfiguration();
        this.makeAuthorizationRequest(options);
    }

    public signOut(postLogoutRedirectUri: string | null = null) {
        this.revokeTokens()
            .then(async () => {
                await this.endSession(postLogoutRedirectUri);
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

    private async endSession(postLogoutRedirectUri: string | null): Promise<void> {
        const url = new URL(this.configuration.endSessionEndpoint); 
        if (postLogoutRedirectUri) {
            url.searchParams.append("post_logout_redirect_uri", postLogoutRedirectUri);
            url.searchParams.append("id_token_hint", await this.getIdToken());
        }
        window.location.href = url.toString();
    }

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

    public setState(data: any) {
      this.state = (Math.random() + 1).toString(36).substring(2);
      localStorage.setItem(`elfsquad-${this.state}`, JSON.stringify(data));
    }

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
        const extras = { 'access_type': 'offline', 'response_mode': 'fragment' };
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
        this.state = new RegExp('state=(.*)(&|$)').exec(locationVariable)[1]

        location.hash = '';
        if (!!error) {
            for (let onSignInRejector of this.onSignInRejectors) {
                onSignInRejector(error);
            }
            return;
        }

        if (!response) { return; }

        let tokenRequest = new TokenRequest({
            client_id: this.options.clientId,
            redirect_uri: this.options.redirectUri,
            grant_type: GRANT_TYPE_AUTHORIZATION_CODE,
            code: response.code ?? new RegExp('#code=(.*?)&').exec(locationVariable)[1],
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

class AuthorizationHandler extends RedirectRequestHandler {
    public completeAuthorizationRequest(): Promise<AuthorizationRequestResponse | null> {
        return super.completeAuthorizationRequest();
    }
}
