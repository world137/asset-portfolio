// Polyfill browser globals missing from Hermes / React Native runtime
const g = globalThis as any;
if (typeof g.DOMException === 'undefined') {
  class DOMException extends Error {
    name: string;
    constructor(message?: string, name?: string) {
      super(message);
      this.name = name ?? 'DOMException';
    }
  }
  g.DOMException = DOMException;
}
