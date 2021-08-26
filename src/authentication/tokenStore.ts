


export class TokenStore {

    private static REFRESH_TOKEN_KEY = 'elfsquad_refresh_token';

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

}