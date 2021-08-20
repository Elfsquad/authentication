import { TokenResponse } from "@openid/appauth/built/token_response";
import { AuthorizationServiceConfiguration } from "@openid/appauth/built/authorization_service_configuration";
import { IAuthenticationOptions } from "./authenticationOptions";
import { AuthorizationRequest } from "@openid/appauth/built/authorization_request";
import { AuthorizationNotifier, AuthorizationRequestResponse } from "@openid/appauth/built/authorization_request_handler";
import { RedirectRequestHandler } from "@openid/appauth/built/redirect_based_handler";
import { GRANT_TYPE_AUTHORIZATION_CODE, GRANT_TYPE_REFRESH_TOKEN, TokenRequest } from "@openid/appauth/built/token_request";
import { AuthorizationError, AuthorizationResponse, BaseTokenRequestHandler, FetchRequestor } from "@openid/appauth";

export class AuthenticationContext {

    private accessTokenResponse: TokenResponse | undefined;
    private configuration: AuthorizationServiceConfiguration;
    private authorizationHandler: AuthorizationHandler;
    private tokenHandler: BaseTokenRequestHandler;
    private refreshToken: string;
    private loginUrl = 'https://login.elfsquad.io'
    private fetchRequestor: FetchRequestor;
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

        this.fetchRequestor = new FetchRequestor();
        this.tokenHandler = new BaseTokenRequestHandler(this.fetchRequestor);
        this.authorizationHandler = new AuthorizationHandler();

        this.authorizationHandler.completeAuthorizationRequest()
        .then(async (result) => {
            this.isInitialized = true;
            if (!!result){
                await this.onAuthorization(result.request, result.response, result.error);
            }

            for (let signedInResolver of this.signedInResolvers) {
                signedInResolver(this.validateAccessTokenResponse());
            }
        });
    }  

    public onSignIn(): Promise<void> {
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
        this.accessTokenResponse = null;
    }

    public isSignedIn(): Promise<boolean> {
        // 
        let promise = new Promise<boolean>((resolve, _) => {
            if (this.isInitialized){
                resolve(this.validateAccessTokenResponse());
                return;
            }

            this.signedInResolvers.push(resolve);
        });

        return promise;
    }

    private validateAccessTokenResponse(): boolean{
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

    private async onAuthorization(request: AuthorizationRequest, response: AuthorizationResponse, error: AuthorizationError): Promise<void>{   
        location.hash = '';
        if (!!error) {
            for (let onSignInRejector of this.onSignInRejectors){
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

        if (request.internal?.code_verifier){
            tokenRequest.extras = { code_verifier: request.internal.code_verifier};
        }
    
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
}

class AuthorizationHandler extends RedirectRequestHandler{


    public completeAuthorizationRequest(): Promise<AuthorizationRequestResponse|null> {
        return super.completeAuthorizationRequest();
    }    
}