import { TokenResponse } from "@openid/appauth/built/token_response";
import { AuthorizationServiceConfiguration } from "@openid/appauth/built/authorization_service_configuration";
import { IAuthenticationOptions } from "./authenticationOptions";
import { AuthorizationRequest } from "@openid/appauth/built/authorization_request";
import { AuthorizationNotifier } from "@openid/appauth/built/authorization_request_handler";
import { RedirectRequestHandler } from "@openid/appauth/built/redirect_based_handler";
import { GRANT_TYPE_AUTHORIZATION_CODE, GRANT_TYPE_REFRESH_TOKEN, TokenRequest } from "@openid/appauth/built/token_request";
import { BaseTokenRequestHandler, FetchRequestor } from "@openid/appauth";

export class AuthenticationContext {

    private accessTokenResponse: TokenResponse | undefined;
    private configuration: AuthorizationServiceConfiguration;
    private notifier: AuthorizationNotifier;
    private authorizationHandler: RedirectRequestHandler;
    private tokenHandler: BaseTokenRequestHandler;
    private refreshToken: string;
    private loginUrl = 'https://login.elfsquad.io'
    private fetchRequestor: FetchRequestor;

    private onSignInResolvers: any[] = [];
    private onSignInRejectors: any[] = [];

    constructor(private options: IAuthenticationOptions) { 
        if (!options) { console.error('No authentication options were provided'); return; }     
        if (!options.clientId) { console.error('No client id provided'); return; }
        if (!options.redirectUri) { console.error('No redirect uri provided'); return; }
        if (!options.scope) { options.scope = 'Elfskot.Api offline_access'; } 
        if (options.loginUrl) { this.loginUrl = options.loginUrl; }

        this.fetchRequestor = new FetchRequestor();
        this.tokenHandler = new BaseTokenRequestHandler(this.fetchRequestor);

        this.notifier = new AuthorizationNotifier();
        // uses a redirect flow
        this.authorizationHandler = new RedirectRequestHandler();
        // set notifier to deliver responses
        this.authorizationHandler.setAuthorizationNotifier(this.notifier);
        // set a listener to listen for authorization responses
        this.notifier.setAuthorizationListener(async (request, response, error) => {
            location.hash = '';
            if (error) {
                for (let onSignInRejector of this.onSignInRejectors){
                    onSignInRejector(error);
                }
                return;
            }

            if (response) {
                let tokenRequest = new TokenRequest({
                    client_id: this.options.clientId,
                    redirect_uri: this.options.redirectUri,
                    grant_type: GRANT_TYPE_AUTHORIZATION_CODE,
                    code: response.code,
                    refresh_token: undefined,
                    extras: { code_verifier: request.internal.code_verifier}
                });
            
                if (!this.configuration){
                    await this.fetchConfiguration();
                }

                this.accessTokenResponse = await this.tokenHandler
                    .performTokenRequest(this.configuration, tokenRequest);
                this.refreshToken = this.accessTokenResponse.refreshToken;
                for (let onSignInResolver of this.onSignInResolvers){
                    onSignInResolver();
                }
            }
        });

        this.authorizationHandler.completeAuthorizationRequestIfPossible();
    }  

    public onSignIn(): Promise<void> {
        let promise = new Promise<void>((resolve, reject) => {
            this.onSignInResolvers.push(resolve);
            this.onSignInRejectors.push(reject);
        });
        return promise;
    }

    public async signIn(): Promise<void> {
        if (this.loggedIn()) { return; }
        await this.fetchConfiguration();
        this.makeAuthorizationRequest();
    }

    public signOut() {
        this.accessTokenResponse = null;
    }

    public loggedIn(): boolean {
        return !!this.accessTokenResponse && this.accessTokenResponse.isValid();
    }

    public getAccessToken(): Promise<string>{
        if (!this.configuration) {
            return Promise.reject("Unknown service configuration");
          }

          if (!this.refreshToken) {
            return Promise.reject("Missing refreshToken.");
          }

          if (this.accessTokenResponse && this.accessTokenResponse.isValid()) {
            return Promise.resolve(this.accessTokenResponse.accessToken);
          }
          
         return this.refreshAccessToken();
    }

    private async refreshAccessToken(): Promise<string>{
        const request = new TokenRequest({
            client_id: this.options.clientId,
            redirect_uri: this.options.redirectUri,
            grant_type: GRANT_TYPE_REFRESH_TOKEN,
            code: undefined,
            refresh_token: this.refreshToken,
            extras: undefined
          });
      
        const response = await this.tokenHandler
            .performTokenRequest(this.configuration, request)
        this.accessTokenResponse = response;
        this.refreshToken = response.refreshToken;
        return response.accessToken;
    }

    private async fetchConfiguration(): Promise<void> {
        this.configuration = await AuthorizationServiceConfiguration.fetchFromIssuer(this.loginUrl, this.fetchRequestor);
    }

    private makeAuthorizationRequest(){
        // create a request
        const request = new AuthorizationRequest({
            client_id: this.options.clientId,
            redirect_uri: this.options.redirectUri,
            scope: this.options.scope,
            response_type: AuthorizationRequest.RESPONSE_TYPE_CODE,
            state: undefined,
            extras: {'prompt': 'login', 'access_type': 'offline', 'response_mode': 'fragment'}
        });

        // make the authorization request
        this.authorizationHandler.performAuthorizationRequest(this.configuration, request);
    }
}