// Polyfill browser globals missing from Hermes / React Native runtime
if (typeof global.DOMException === 'undefined') {
  class DOMException extends Error {
    name: string;
    constructor(message?: string, name?: string) {
      super(message);
      this.name = name ?? 'DOMException';
    }
  }
  (global as any).DOMException = DOMException;
}
