import { TokenResponse } from "@openid/appauth/built/token_response";
import { AuthorizationServiceConfiguration } from "@openid/appauth/built/authorization_service_configuration";
import { IAuthenticationOptions } from "./authenticationOptions";
import { AuthorizationRequest } from "@openid/appauth/built/authorization_request";
import { AuthorizationNotifier } from "@openid/appauth/built/authorization_request_handler";
import { RedirectRequestHandler } from "@openid/appauth/built/redirect_based_handler";
import { GRANT_TYPE_AUTHORIZATION_CODE, TokenRequest } from "@openid/appauth/built/token_request";
import { BaseTokenRequestHandler } from "@openid/appauth";

export class AuthenticationContext {

    private accessTokenResponse: TokenResponse | undefined;
    private configuration: AuthorizationServiceConfiguration;
    private notifier: AuthorizationNotifier;
    private authorizationHandler: RedirectRequestHandler;
    private tokenHandler: BaseTokenRequestHandler;
    private refreshToken: string;
    private loginUrl = 'https://login.elfsquad.io'



    constructor(private options: IAuthenticationOptions) { 
        if (!options) { console.error('No authentication options were provided'); }     
        if (!options.scope) { options.scope = 'Elfskot.Api'; } 

        if (this.useUserAuthentication()){
            this.notifier = new AuthorizationNotifier();
            // uses a redirect flow
            this.authorizationHandler = new RedirectRequestHandler();
            // set notifier to deliver responses
            this.authorizationHandler.setAuthorizationNotifier(this.notifier);
            // set a listener to listen for authorization responses
            this.notifier.setAuthorizationListener(async (request, response, error) => {
                console.log('authorization response', response);
                if (response) {
                    let request = new TokenRequest({
                        client_id: this.options.clientId,
                        redirect_uri: this.options.redirectUri,
                        grant_type: GRANT_TYPE_AUTHORIZATION_CODE,
                        code: response.code,
                        refresh_token: undefined
                      });
                  
                      this.accessTokenResponse = await this.tokenHandler
                        .performTokenRequest(this.configuration, request);

                    console.log('accessTokenResponse', this.accessTokenResponse);
                }
            });
        }
    }  

    public fetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
        if (!init) {  init = { }; }
        if (!init.headers) { init.headers = {}; }
        
        if (this.useElfsquadHeaderAuthentication()){
            init.headers['x-elfsquad-id'] = this.options.tenantId;
        }
        else if (this.useUserAuthentication()){
            // TODO: get access_token
        }

        return fetch(input, init);
    }

    public async signIn(): Promise<void> {
        if (!this.useUserAuthentication()) { console.error('ClientId or Redirect Uri not provided'); }
        if (this.loggedIn()) { return; }

        await this.fetchConfiguration();
        await this.makeAuthorizationRequest();
    }

    public loggedIn(): boolean {
        return !!this.accessTokenResponse && this.accessTokenResponse.isValid();
    }

    private async fetchConfiguration(): Promise<void> {
        this.configuration = await AuthorizationServiceConfiguration.fetchFromIssuer(this.loginUrl);
    }

    private async makeAuthorizationRequest(): Promise<void>{
        // create a request
        const request = new AuthorizationRequest({
            client_id: this.options.clientId,
            redirect_uri: this.options.redirectUri,
            scope: this.options.scope,
            response_type: AuthorizationRequest.RESPONSE_TYPE_CODE,
            state: undefined,
            extras: {'prompt': 'consent', 'access_type': 'offline'}
        });

        // make the authorization request
        this.authorizationHandler.performAuthorizationRequest(this.configuration, request);
    }

    private useElfsquadHeaderAuthentication(): boolean{
        return !!this.options.tenantId && !this.useUserAuthentication();
    }

    private useUserAuthentication(): boolean {
        return !!this.options.clientId && !!this.options.redirectUri;
    }

}