// In-memory localStorage implementation for the node test environment
const store: Record<string, string> = {};
const localStorageMock = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};
(global as any).localStorage = localStorageMock;
const historyMock = { replaceState: () => {} };
(global as any).window = { localStorage: localStorageMock, location: {}, history: historyMock };
(global as any).location = {};
(global as any).history = historyMock;
