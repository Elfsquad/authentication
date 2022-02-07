import { TokenResponse } from "@openid/appauth/built/token_response";
import { AuthorizationServiceConfiguration } from "@openid/appauth/built/authorization_service_configuration";
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

    public async signIn(): Promise<void> {
        await this.fetchConfiguration();
        this.makeAuthorizationRequest();
    }

    public signOut() {
        this.revokeTokens()
          .then(_ => {
            this.deleteTokens();
            this.endSession();
          });
    }

    private deleteTokens() {
        this.accessTokenResponse = null;
        TokenStore.deleteRefreshToken();
        TokenStore.deleteTokenResponse();
    }

    private revokeTokens(): Promise<any> {
      let revokeRefreshToken = null;
      let revokeAccessToken = null;
      if (TokenStore.hasRefreshToken()) {
        this.revokeToken(TokenStore.getRefreshToken(), 'refresh_token');
      }
      if (TokenStore.hasTokenResponse()) {
        this.revokeToken(TokenStore.getTokenResponse().accessToken, 'access_token');
      }
      return Promise.all([revokeRefreshToken, revokeAccessToken]);
    }

    private async revokeToken(token: string, tokenType: TokenTypeHint) {
      const request = new RevokeTokenRequest({
        token: token,
        token_type_hint: tokenType,
        client_id: this.options.clientId
      });

      const response = await this.tokenHandler.performRevokeTokenRequest(this.configuration, request);
      console.log(tokenType, response);
      if (!response) {
        console.error(`Revoke token request for token '${tokenType}' failed`);
      }
    }

    private endSession() {
      window.location.href = this.configuration.endSessionEndpoint;
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
        if (!this.configuration) {
            return null;
        }

        if (this.validateAccessTokenResponse()) {
            return Promise.resolve(this.accessTokenResponse.accessToken);
        }

        if (!TokenStore.hasRefreshToken()) {
            return Promise.reject("Missing refreshToken.");
        }

        if (this._refreshTokenPromise){
            return this._refreshTokenPromise;
        }

        this._refreshTokenPromise = this.refreshAccessToken();
        let accessToken = await this._refreshTokenPromise;
        this._refreshTokenPromise = null;
        return accessToken;
    }

    public async getIdToken(): Promise<string> {
        if (!this.configuration) {
            return Promise.reject("Unknown service configuration");
        }

        if (this.validateAccessTokenResponse()) {
            return Promise.resolve(this.accessTokenResponse.idToken);
        }

        if (!TokenStore.hasRefreshToken()) {
            return Promise.reject("Missing refreshToken.");
        }

        await this.refreshAccessToken();
        return Promise.resolve(this.accessTokenResponse.idToken);
    }

    private validateAccessTokenResponse(): boolean {
        // `accessTokenResponse.isValid` uses a default buffer of 10 min
        return !!this.accessTokenResponse && this.accessTokenResponse.isValid();
    }

    private async refreshAccessToken(): Promise<string> {
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

    private makeAuthorizationRequest() {
        // create a request
        const request = new AuthorizationRequest({
            client_id: this.options.clientId,
            redirect_uri: this.options.redirectUri,
            scope: this.options.scope,
            response_type: AuthorizationRequest.RESPONSE_TYPE_CODE,
            state: undefined,
            extras: { 'access_type': 'offline', 'response_mode': 'fragment' }
        });

        // make the authorization request
        this.authorizationHandler.performAuthorizationRequest(this.configuration, request);
    }

    private async onAuthorization(request: AuthorizationRequest, response: AuthorizationResponse, error: AuthorizationError): Promise<void> {
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
            code: response.code,
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
        this.callOnSigInResolvers();
    }

    private async initialize(): Promise<void> {
        await this.fetchConfiguration();

        if (TokenStore.hasTokenResponse()) {
            this.accessTokenResponse = TokenStore.getTokenResponse();
        }

        // If the access token is still valid, we do not need to refresh
        if (this.validateAccessTokenResponse()) {
            this.isInitialized = true;
            this.callOnSigInResolvers();
            this.callSignedInResolvers();
            return;
        }

        if (TokenStore.hasRefreshToken()) {
            await this.fetchConfiguration();
            this.refreshAccessToken()
            .then(() => {
                this.callOnSigInResolvers();   
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

    private callOnSigInResolvers():void{
        for (let onSignInResolver of this.onSignInResolvers) {
            onSignInResolver();
        }
    }
}

class AuthorizationHandler extends RedirectRequestHandler {
    public completeAuthorizationRequest(): Promise<AuthorizationRequestResponse | null> {
        return super.completeAuthorizationRequest();
    }
}
