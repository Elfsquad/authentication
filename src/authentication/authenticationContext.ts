import { IAuthenticationOptions } from "./authenticationOptions";

export class AuthenticationContext {

    constructor(private options: IAuthenticationOptions) { }  

    public fetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
        if (!init) {  init = { }; }
        if (!init.headers) { init.headers = {}; }
        
        if (this.useAnonymousAuthentication()){
            init.headers['x-elfsquad-id'] = this.options.tenantId;
        }
        else if (this.useUserAuthentication()){
            // TODO: get access_token
        }

        return fetch(input, init);
    }

    private useAnonymousAuthentication(): boolean{
        return !!this.options.tenantId && !this.useUserAuthentication();
    }

    private useUserAuthentication(): boolean {
        return !!this.options.clientId && !!this.options.redirectUri;
    }
}