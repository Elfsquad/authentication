import { TokenResponse } from "@openid/appauth/built/token_response";
import { AuthorizationServiceConfiguration } from "@openid/appauth/built/authorization_service_configuration";
import { IAuthenticationOptions } from "./authenticationOptions";
import { AuthorizationRequest } from "@openid/appauth/built/authorization_request";
import { AuthorizationNotifier } from "@openid/appauth/built/authorization_request_handler";
import { RedirectRequestHandler } from "@openid/appauth/built/redirect_based_handler";
import { GRANT_TYPE_AUTHORIZATION_CODE, TokenRequest } from "@openid/appauth/built/token_request";
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
        console.log('setAuthorizationListener');
        this.notifier.setAuthorizationListener(async (request, response, error) => {
            location.hash = '';
            
            console.log('setAuthorizationListener request', request);
            if (error) {
                for (let onSignInRejector of this.onSignInRejectors){
                    onSignInRejector(error);
                }
                return;
            }

            console.log('authorization response', response);
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


                console.log('accessTokenResponse', this.accessTokenResponse);


                console.log('onSignInResolvers', this.onSignInResolvers)
                for (let onSignInResolver of this.onSignInResolvers){
                    onSignInResolver
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

    public loggedIn(): boolean {
        return !!this.accessTokenResponse && this.accessTokenResponse.isValid();
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