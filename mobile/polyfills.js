// Injected at bundle head by Metro before any module initialization.
// undici (used by RN 0.81 fetch) references DOMException before RN sets it up globally.
if (typeof global.DOMException === 'undefined') {
  global.DOMException = class DOMException extends Error {
    constructor(message, name) {
      super(message);
      this.name = name || 'DOMException';
    }
  };
}
