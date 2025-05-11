// Mock the crypto.randomUUID function
global.crypto = {
  randomUUID: () => '00000000-0000-0000-0000-000000000000'
};

// Mock Headers, Request, Response
global.Headers = class Headers {
  constructor(init) {
    this.headers = new Map();
    if (init) {
      Object.entries(init).forEach(([key, value]) => {
        this.headers.set(key.toLowerCase(), value);
      });
    }
  }

  get(name) {
    return this.headers.get(name.toLowerCase()) || null;
  }

  set(name, value) {
    this.headers.set(name.toLowerCase(), value);
  }

  has(name) {
    return this.headers.has(name.toLowerCase());
  }

  append(name, value) {
    const existing = this.get(name);
    if (existing) {
      this.set(name, `${existing}, ${value}`);
    } else {
      this.set(name, value);
    }
  }

  delete(name) {
    this.headers.delete(name.toLowerCase());
  }

  *entries() {
    yield* this.headers.entries();
  }

  *keys() {
    yield* this.headers.keys();
  }

  *values() {
    yield* this.headers.values();
  }
};

global.Request = class Request {
  constructor(url, options = {}) {
    this.url = url;
    this.method = options.method || 'GET';
    this.headers = new Headers(options.headers);
    this._body = options.body || '';
  }

  async json() {
    return typeof this._body === 'string' ? JSON.parse(this._body) : this._body;
  }

  async text() {
    return this._body.toString();
  }
};

global.Response = class Response {
  constructor(body, options = {}) {
    this._body = body;
    this.status = options.status || 200;
    this.statusText = options.statusText || '';
    this.headers = new Headers(options.headers);
  }

  async json() {
    return typeof this._body === 'string' ? JSON.parse(this._body) : this._body;
  }

  async text() {
    return this._body ? this._body.toString() : '';
  }
};

// Mock TransformStream
global.TransformStream = class TransformStream {
  constructor() {
    const self = this;
    this.readable = {
      getReader() {
        return {
          read() {
            return Promise.resolve({ done: false, value: new Uint8Array() });
          },
          releaseLock() {}
        };
      }
    };

    this.writable = {
      getWriter() {
        return {
          write(chunk) {
            return Promise.resolve();
          },
          close() {
            return Promise.resolve();
          },
          abort() {
            return Promise.resolve();
          }
        };
      }
    };
  }
};