// Minimal Jest global declarations to satisfy the TypeScript language server
// during development when @types/jest is not installed.

declare var describe: (name: string, fn: () => void) => void;
declare var it: (name: string, fn: () => void) => void;
declare var test: (name: string, fn: () => void) => void;
declare var beforeAll: (fn: () => Promise<void> | void, timeout?: number) => void;
declare var afterAll: (fn: () => Promise<void> | void, timeout?: number) => void;
declare var beforeEach: (fn: () => Promise<void> | void, timeout?: number) => void;
declare var afterEach: (fn: () => Promise<void> | void, timeout?: number) => void;

declare function expect(actual: any): any;
declare const jest: any;

export {};
