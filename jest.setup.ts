// In-memory localStorage implementation for the node test environment
const store: Record<string, string> = {};
const localStorageMock = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};
(global as any).localStorage = localStorageMock;
(global as any).window = { localStorage: localStorageMock, location: {} };
(global as any).location = {};

// Provide a fetch stub that returns a minimal OIDC discovery document.
// This prevents the constructor's async initialize() → fetchConfiguration() from
// throwing an unhandled rejection.  Tests bypass real network calls by pre-setting
// (authenticationContext as any).configuration before exercising other methods.
const oidcDiscovery = {
    authorization_endpoint: 'https://test/auth',
    token_endpoint: 'https://test/token',
    revocation_endpoint: 'https://test/revoke',
    end_session_endpoint: 'https://test/logout',
    userinfo_endpoint: 'https://test/userinfo',
    issuer: 'https://test',
    jwks_uri: 'https://test/jwks',
};
(global as any).fetch = () => Promise.resolve({
    ok: true,
    status: 200,
    headers: { get: (name: string) => name === 'content-type' ? 'application/json' : null },
    json: () => Promise.resolve(oidcDiscovery),
    text: () => Promise.resolve(JSON.stringify(oidcDiscovery)),
});
