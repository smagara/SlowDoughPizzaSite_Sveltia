/**
 * Browser-side polyfill of the File System Access API (`window.showDirectoryPicker`) backed by an
 * in-memory file tree. Injected by the e2e test so Sveltia CMS's "Work with Local Repository"
 * mode can be exercised headlessly (the real picker needs a native OS dialog + user gesture).
 *
 * Only the subset Sveltia uses is implemented: entries()/values()/keys(), getFileHandle,
 * getDirectoryHandle, removeEntry, getFile, createWritable, query/requestPermission.
 * The tree is exposed as `window.__fakeFs` so the test can read back what the CMS wrote.
 *
 * Usage (from Playwright): page.addInitScript({ content: `${source}; installFakeFileSystem(${json})` })
 */
function installFakeFileSystem(seedFiles) {
  /** @type {Map<string, string>} path → text */
  const files = new Map(Object.entries(seedFiles));
  window.__fakeFs = files;

  const typeMismatch = (name) => Object.assign(new DOMException(`${name} is not a file/directory`, 'TypeMismatchError'));
  const notFound = (name) => new DOMException(`${name} not found`, 'NotFoundError');

  const childrenOf = (dir) => {
    const prefix = dir ? `${dir}/` : '';
    const names = new Map(); // name → 'file' | 'directory'
    for (const path of files.keys()) {
      if (!path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length);
      const slash = rest.indexOf('/');
      if (slash === -1) names.set(rest, 'file');
      else names.set(rest.slice(0, slash), 'directory');
    }
    return names;
  };

  class FakeFileHandle {
    constructor(path) {
      Object.defineProperty(this, '_path', { value: path, enumerable: false, configurable: true });
    }
    get kind() { return 'file'; }
    get name() { return this._path.split('/').pop(); }
    async getFile() {
      const text = files.get(this._path) ?? '';
      return new File([text], this.name, { type: 'text/plain', lastModified: Date.now() });
    }
    async createWritable() {
      const chunks = [];
      const path = this._path;
      return {
        async write(data) {
          if (data && typeof data === 'object' && 'data' in data && data.type === 'write') data = data.data;
          chunks.push(typeof data === 'string' ? data : await new Blob([data]).text());
        },
        async seek() {},
        async truncate() { chunks.length = 0; },
        async close() { files.set(path, chunks.join('')); },
        async abort() {},
      };
    }
    /** Chromium's atomic rename: move(newName) | move(dirHandle) | move(dirHandle, newName). */
    async move(a, b) {
      const dir = typeof a === 'string' ? this._path.split('/').slice(0, -1).join('/') : a._path;
      const name = typeof a === 'string' ? a : b ?? this.name;
      const target = dir ? `${dir}/${name}` : name;
      files.set(target, files.get(this._path) ?? '');
      files.delete(this._path);
      Object.defineProperty(this, '_path', { value: target, enumerable: false });
    }
    async queryPermission() { return 'granted'; }
    async requestPermission() { return 'granted'; }
    async isSameEntry(other) { return other?._path === this._path; }
  }

  class FakeDirectoryHandle {
    constructor(path) {
      Object.defineProperty(this, '_path', { value: path, enumerable: false });
    }
    get kind() { return 'directory'; }
    get name() { return this._path === '' ? 'SlowDoughPizzaSite_Sveltia' : this._path.split('/').pop(); }
    #child(name) { return this._path ? `${this._path}/${name}` : name; }
    async *entries() {
      for (const [name, kind] of childrenOf(this._path)) {
        yield [name, kind === 'file' ? new FakeFileHandle(this.#child(name)) : new FakeDirectoryHandle(this.#child(name))];
      }
    }
    async *values() { for await (const [, h] of this.entries()) yield h; }
    async *keys() { for await (const [n] of this.entries()) yield n; }
    [Symbol.asyncIterator]() { return this.entries(); }
    async getFileHandle(name, { create = false } = {}) {
      const kind = childrenOf(this._path).get(name);
      const path = this.#child(name);
      if (kind === 'directory') throw typeMismatch(name);
      if (!kind) {
        if (!create) throw notFound(name);
        files.set(path, '');
      }
      return new FakeFileHandle(path);
    }
    async getDirectoryHandle(name, { create = false } = {}) {
      const kind = childrenOf(this._path).get(name);
      if (kind === 'file') throw typeMismatch(name);
      if (!kind && !create) throw notFound(name);
      // Directories are implicit; creating one is a no-op until a file is written.
      if (!kind) files.set(`${this.#child(name)}/.gitkeep`, '');
      return new FakeDirectoryHandle(this.#child(name));
    }
    async removeEntry(name, { recursive = false } = {}) {
      const kind = childrenOf(this._path).get(name);
      if (!kind) throw notFound(name);
      const path = this.#child(name);
      if (kind === 'file') files.delete(path);
      else if (recursive || true) for (const p of [...files.keys()]) if (p.startsWith(`${path}/`)) files.delete(p);
    }
    async resolve() { return null; }
    async queryPermission() { return 'granted'; }
    async requestPermission() { return 'granted'; }
    async isSameEntry(other) { return other?._path === this._path; }
  }

  window.showDirectoryPicker = async () => new FakeDirectoryHandle('');
}
