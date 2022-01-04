


export class TokenStore {

    private static REFRESH_TOKEN_KEY = 'elfsquad_refresh_token';
    private static ACCESS_TOKEN_KEY = 'elfsquad_access_token';

    static hasRefreshToken(): boolean{
        return !!localStorage.getItem(this.REFRESH_TOKEN_KEY);
    }

    static getRefreshToken(): string{
        return localStorage.getItem(this.REFRESH_TOKEN_KEY);
    }

    static saveRefreshToken(refreshToken:string): void {
        localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    }

    static deleteRefreshToken():void{
        localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    } 

    static hasAccessToken(): boolean{
        return !!localStorage.getItem(this.ACCESS_TOKEN_KEY);
    }

    static getAccessToken(): string{
        return localStorage.getItem(this.ACCESS_TOKEN_KEY);
    }

    static saveAccessToken(accessToken:string): void {
        localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
    }

    static deleteAccessToken():void{
        localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    }
}
