/**
 * In-memory simulation of the slice of the GitHub REST + GraphQL API that Sveltia CMS uses for
 * the GitHub backend with Editorial Workflow (branch → commit → pull request → labels → merge).
 *
 * It exists so the CMS integration can be tested end-to-end *offline* and deterministically,
 * with the real production configuration (src/admin/config.ts) and the real Sveltia bundle —
 * the browser's requests to https://api.github.com are intercepted by Playwright (see
 * cms-workflow.test.mjs) and answered here.
 *
 * The git model is deliberately simple: a branch is a head SHA plus a full snapshot of files.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const sha1 = (s) => createHash('sha1').update(s).digest('hex');
const nowIso = () => new Date().toISOString();

export class GitHubMock {
  /**
   * @param {object} o
   * @param {string} o.owner
   * @param {string} o.repo
   * @param {string} o.rootDir      Directory whose files seed the `main` branch
   * @param {string[]} o.include    Path prefixes (relative to rootDir) to include in the repo
   * @param {string} [o.login]      Login of the signed-in collaborator
   * @param {string[]} [o.collaborators]
   */
  constructor({ owner, repo, rootDir, include, login = 'pizza-manager', collaborators = ['pizza-manager'] }) {
    this.owner = owner;
    this.repo = repo;
    this.login = login;
    this.collaborators = collaborators;
    this.defaultBranch = 'main';
    /** @type {Map<string, {sha:string, files: Map<string,string>}>} */
    this.branches = new Map();
    /** @type {Map<string, {sha:string, message:string, date:string, branch:string}>} */
    this.commits = new Map();
    /** @type {Map<string, string>} blob sha → content */
    this.blobs = new Map();
    this.pulls = [];
    this.prCounter = 40;
    this.log = [];

    const files = new Map();
    for (const prefix of include) {
      const abs = join(rootDir, prefix);
      if (statSync(abs).isDirectory()) {
        for (const f of walk(abs)) files.set(relative(rootDir, f).replaceAll('\\', '/'), readFileSync(f, 'utf8'));
      } else {
        files.set(prefix, readFileSync(abs, 'utf8'));
      }
    }
    const sha = this.#commit('main', files, 'baseline');
    this.branches.set('main', { sha, files });
  }

  // ----------------------------------------------------------------------- helpers
  #blobSha(content) {
    const sha = sha1(`blob ${Buffer.byteLength(content)}\0${content}`);
    this.blobs.set(sha, content);
    return sha;
  }

  #commit(branch, files, message) {
    const tree = [...files.entries()].map(([p, c]) => `${p}:${this.#blobSha(c)}`).join('\n');
    const sha = sha1(`${branch}\n${message}\n${tree}\n${Math.random()}`);
    this.commits.set(sha, { sha, message, date: nowIso(), branch, files: new Map(files) });
    return sha;
  }

  #user() {
    return {
      login: this.login,
      id: 1001,
      name: 'Pizza Manager',
      email: 'manager@slowdoughpizza.example',
      avatar_url: '',
      html_url: `https://github.com/${this.login}`,
      type: 'User',
    };
  }

  #pr(number) {
    return this.pulls.find((p) => p.number === number);
  }

  #prFiles(pr) {
    const base = this.branches.get(pr.base)?.files ?? new Map();
    const head = this.branches.get(pr.head)?.files ?? pr.headFilesSnapshot ?? new Map();
    const out = [];
    for (const [p, c] of head) {
      if (!base.has(p)) out.push({ path: p, changeType: 'ADDED', status: 'added' });
      else if (base.get(p) !== c) out.push({ path: p, changeType: 'MODIFIED', status: 'modified' });
    }
    for (const p of base.keys()) if (!head.has(p)) out.push({ path: p, changeType: 'DELETED', status: 'removed' });
    return out;
  }

  #prJson(pr) {
    return {
      number: pr.number,
      node_id: pr.nodeId,
      title: pr.title,
      body: pr.body,
      html_url: `https://github.com/${this.owner}/${this.repo}/pull/${pr.number}`,
      state: pr.state === 'MERGED' ? 'closed' : pr.state.toLowerCase(),
      draft: pr.draft,
      merged: pr.state === 'MERGED',
      created_at: pr.createdAt,
      updated_at: pr.updatedAt,
      head: { ref: pr.head, sha: this.branches.get(pr.head)?.sha ?? pr.headSha },
      base: { ref: pr.base },
      labels: pr.labels.map((name) => ({ name })),
      user: this.#user(),
    };
  }

  /** Human-readable activity log (used by the test to assert the workflow). */
  record(kind, detail) {
    this.log.push({ kind, ...detail });
  }

  // ----------------------------------------------------------------------- entry point
  /**
   * @param {{method:string, url:string, headers:Record<string,string>, body?:string}} req
   * @returns {{status:number, body?:any, headers?:Record<string,string>}}
   */
  handle({ method, url, headers, body }) {
    const u = new URL(url);
    const auth = headers.authorization ?? headers.Authorization ?? '';
    if (!/^(token|bearer) \S+/i.test(auth)) return { status: 401, body: { message: 'Requires authentication' } };

    let path = u.pathname.replace(/^\/api\/v3/, '');
    if (path === '/graphql' || path === '/api/graphql') return this.#graphql(JSON.parse(body || '{}'));
    return this.#rest(method.toUpperCase(), path, u.searchParams, body ? JSON.parse(body) : undefined);
  }

  // ----------------------------------------------------------------------- REST
  #rest(method, path, params, json) {
    const R = `/repos/${this.owner}/${this.repo}`;
    const m = (re) => path.match(re);
    let x;

    if (path === '/user') return { status: 200, body: this.#user() };
    if (path === '/user/repository_invitations') return { status: 200, body: [] };

    if (path === R) {
      return {
        status: 200,
        body: {
          full_name: `${this.owner}/${this.repo}`,
          default_branch: this.defaultBranch,
          private: false,
          allow_forking: true,
          owner: { login: this.owner, type: 'User' },
          permissions: { push: this.collaborators.includes(this.login), pull: true, admin: false },
        },
      };
    }

    if ((x = m(new RegExp(`^${R}/collaborators/([^/]+)$`)))) {
      const ok = this.collaborators.includes(decodeURIComponent(x[1]));
      return ok ? { status: 204 } : { status: 404, body: { message: 'Not Found' } };
    }

    if ((x = m(new RegExp(`^${R}/git/trees/([^/]+)$`)))) {
      const ref = decodeURIComponent(x[1]);
      const branch = this.branches.get(ref) ?? this.commits.get(ref); // branch name or commit SHA
      if (!branch) return { status: 404, body: { message: 'Not Found' } };
      return {
        status: 200,
        body: {
          sha: branch.sha,
          truncated: false,
          tree: [...branch.files.entries()].map(([p, c]) => ({
            path: p,
            type: 'blob',
            mode: '100644',
            sha: this.#blobSha(c),
            size: Buffer.byteLength(c),
          })),
        },
      };
    }

    if ((x = m(new RegExp(`^${R}/git/blobs/([0-9a-f]+)$`)))) {
      const content = this.blobs.get(x[1]);
      if (content === undefined) return { status: 404, body: { message: 'Not Found' } };
      return { status: 200, body: content, headers: { 'content-type': 'text/plain; charset=utf-8' }, raw: true };
    }

    if ((x = m(new RegExp(`^${R}/git/refs/heads/(.+)$`)))) {
      const name = decodeURI(x[1]);
      if (method === 'DELETE') {
        this.branches.delete(name);
        this.record('branch.delete', { branch: name });
        return { status: 204 };
      }
      if (method === 'PATCH') {
        const base = this.branches.get('main');
        this.branches.set(name, { sha: json.sha ?? base.sha, files: new Map(base.files) });
        return { status: 200, body: { ref: `refs/heads/${name}`, object: { sha: json.sha } } };
      }
    }

    if (path === `${R}/pulls` && method === 'POST') {
      const pr = {
        number: ++this.prCounter,
        nodeId: `PR_${sha1(String(this.prCounter)).slice(0, 12)}`,
        title: json.title,
        body: json.body,
        head: json.head,
        base: json.base,
        draft: !!json.draft,
        state: 'OPEN',
        labels: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
        headSha: this.branches.get(json.head)?.sha,
      };
      this.pulls.push(pr);
      this.record('pull.create', { number: pr.number, title: pr.title, head: pr.head, base: pr.base, draft: pr.draft });
      return { status: 201, body: this.#prJson(pr) };
    }

    if ((x = m(new RegExp(`^${R}/pulls/(\\d+)/files$`)))) {
      const pr = this.#pr(Number(x[1]));
      return { status: 200, body: this.#prFiles(pr).map((f) => ({ filename: f.path, status: f.status })) };
    }

    if ((x = m(new RegExp(`^${R}/pulls/(\\d+)/merge$`))) && method === 'PUT') {
      const pr = this.#pr(Number(x[1]));
      const head = this.branches.get(pr.head);
      const main = this.branches.get('main');
      main.files = new Map(head.files);
      main.sha = this.#commit('main', main.files, json?.commit_title ?? pr.title);
      pr.state = 'MERGED';
      pr.headFilesSnapshot = new Map(head.files);
      pr.updatedAt = nowIso();
      this.record('pull.merge', { number: pr.number, method: json?.merge_method });
      return { status: 200, body: { sha: main.sha, merged: true, message: 'Pull Request successfully merged' } };
    }

    if ((x = m(new RegExp(`^${R}/pulls/(\\d+)$`))) && method === 'PATCH') {
      const pr = this.#pr(Number(x[1]));
      if (json.state === 'closed') pr.state = 'CLOSED';
      if (json.state === 'open') pr.state = 'OPEN';
      pr.updatedAt = nowIso();
      this.record('pull.update', { number: pr.number, state: pr.state });
      return { status: 200, body: this.#prJson(pr) };
    }

    if ((x = m(new RegExp(`^${R}/issues/(\\d+)/labels$`))) && method === 'POST') {
      const pr = this.#pr(Number(x[1]));
      pr.labels = [...new Set([...pr.labels, ...json.labels])];
      this.record('labels.add', { number: pr.number, labels: json.labels });
      return { status: 200, body: pr.labels.map((name) => ({ name })) };
    }

    if ((x = m(new RegExp(`^${R}/issues/(\\d+)$`)))) {
      const pr = this.#pr(Number(x[1]));
      if (method === 'PATCH') {
        if (json.labels) pr.labels = [...json.labels];
        if (json.state) pr.state = json.state.toUpperCase();
        this.record('labels.set', { number: pr.number, labels: pr.labels });
      }
      return { status: 200, body: { number: pr.number, labels: pr.labels.map((name) => ({ name })) } };
    }

    if ((x = m(new RegExp(`^${R}/compare/(.+)$`)))) {
      const [base, head] = decodeURI(x[1]).split('...');
      const pr = { base, head: head.includes(':') ? head.split(':')[1] : head };
      return { status: 200, body: { files: this.#prFiles(pr).map((f) => ({ filename: f.path, status: f.status })) } };
    }

    this.record('unhandled.rest', { method, path });
    return { status: 404, body: { message: `mock: unhandled ${method} ${path}` } };
  }

  // ----------------------------------------------------------------------- GraphQL
  #graphql({ query, variables = {} }) {
    const q = query.replace(/\s+/g, ' ');
    const repo = (data) => ({ status: 200, body: { data: { repository: data } } });

    // --- mutations ---------------------------------------------------------------
    if (/mutation/.test(q)) {
      if (/createRef\(/.test(q)) {
        const name = variables.input.name.replace(/^refs\/heads\//, '');
        if (this.branches.has(name)) {
          return { status: 200, body: { errors: [{ message: `A ref named "refs/heads/${name}" already exists in the repository.` }] } };
        }
        const base = [...this.branches.values()].find((b) => b.sha === variables.input.oid) ?? this.branches.get('main');
        this.branches.set(name, { sha: base.sha, files: new Map(base.files) });
        this.record('branch.create', { branch: name, from: variables.input.oid });
        return { status: 200, body: { data: { createRef: { ref: { name } } } } };
      }

      if (/createCommitOnBranch\(/.test(q)) {
        const { branch: { branchName }, expectedHeadOid, fileChanges, message } = variables.input;
        const branch = this.branches.get(branchName);
        if (!branch) return { status: 200, body: { errors: [{ message: `Branch ${branchName} not found` }] } };
        if (branch.sha !== expectedHeadOid) {
          return { status: 200, body: { errors: [{ message: 'Expected branch to point to a different commit (expectedHeadOid mismatch)' }] } };
        }
        const files = new Map(branch.files);
        for (const { path, contents } of fileChanges.additions ?? []) files.set(path, Buffer.from(contents, 'base64').toString('utf8'));
        for (const { path } of fileChanges.deletions ?? []) files.delete(path);
        branch.files = files;
        branch.sha = this.#commit(branchName, files, message.headline);
        this.record('commit', {
          branch: branchName,
          message: message.headline,
          additions: (fileChanges.additions ?? []).map((a) => a.path),
          deletions: (fileChanges.deletions ?? []).map((d) => d.path),
        });
        const commit = { oid: branch.sha, committedDate: nowIso() };
        for (const [, alias, p] of q.matchAll(/(file_\d+): file\(path: "([^"]+)"\)/g)) {
          commit[alias] = { oid: this.#blobSha(files.get(p) ?? '') };
        }
        return { status: 200, body: { data: { createCommitOnBranch: { commit } } } };
      }

      if (/markPullRequestReadyForReview|convertPullRequestToDraft/.test(q)) {
        const pr = this.pulls.find((p) => p.nodeId === variables.input.pullRequestId);
        pr.draft = /convertPullRequestToDraft/.test(q);
        pr.updatedAt = nowIso();
        this.record('pull.draft', { number: pr.number, draft: pr.draft });
        const key = pr.draft ? 'convertPullRequestToDraft' : 'markPullRequestReadyForReview';
        return { status: 200, body: { data: { [key]: { pullRequest: { isDraft: pr.draft } } } } };
      }
    }

    // --- queries ------------------------------------------------------------------
    if (/defaultBranchRef \{ name \}/.test(q)) return repo({ defaultBranchRef: { name: this.defaultBranch } });

    if (/node\(id: \$id\)/.test(q)) {
      const pr = this.pulls.find((p) => p.nodeId === variables.id);
      return { status: 200, body: { data: { node: pr ? { state: pr.state, isDraft: pr.draft } : null } } };
    }

    if (/fork: repository/.test(q)) {
      const main = this.branches.get('main');
      return { status: 200, body: { data: { fork: { id: 'R_repo' }, base: { ref: { target: { oid: main.sha } } } } } };
    }

    if (/pullRequests\(headRefName: \$branch, states: OPEN, first: 1\)/.test(q)) {
      const n = this.pulls.filter((p) => p.head === variables.branch && p.state === 'OPEN').length;
      return repo({ pullRequests: { totalCount: n } });
    }

    if (/pullRequests\( states: OPEN labels:/.test(q)) {
      const labels = JSON.parse(q.match(/labels: (\[[^\]]*\])/)[1]);
      const nodes = this.pulls
        .filter((p) => p.state === 'OPEN' && p.labels.some((l) => labels.includes(l)))
        .map((p) => ({
          id: p.nodeId,
          number: p.number,
          title: p.title,
          url: `https://github.com/${this.owner}/${this.repo}/pull/${p.number}`,
          isDraft: p.draft,
          isCrossRepository: false,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          headRefName: p.head,
          headRefOid: this.branches.get(p.head)?.sha,
          author: { login: this.login, avatarUrl: '', name: 'Pizza Manager', email: '', databaseId: 1001 },
          labels: { nodes: p.labels.map((name) => ({ name })) },
          files: { nodes: this.#prFiles(p).map(({ path, changeType }) => ({ path, changeType })) },
        }));
      return repo({ pullRequests: { nodes } });
    }

    // Branch head SHA
    if (/ref\(qualifiedName: \$branch\) \{ target \{ \.\.\. on Commit \{ oid \}/.test(q)) {
      const b = this.branches.get(variables.branch);
      return repo({ ref: b ? { target: { oid: b.sha } } : null });
    }

    // Last commit on a branch
    if (/ref\(qualifiedName: \$branch\) \{ target \{ \.\.\. on Commit \{ history\(first: 1\) \{ nodes \{ oid message/.test(q)) {
      const b = this.branches.get(variables.branch ?? this.defaultBranch);
      if (!b) return repo({ ref: null });
      const c = this.commits.get(b.sha);
      return repo({ ref: { target: { history: { nodes: [{ oid: b.sha, message: c?.message ?? '' }] } } } });
    }

    // Aliased batch queries: content_N (blob by oid), commit_N (history per path), file_N (blob by expression),
    // history_N (file commits), deployment info (object(oid) ... on Commit { status ... })
    const data = {};
    let matched = false;

    for (const [, alias, oid] of q.matchAll(/(content_\d+): object\(oid: "([0-9a-f]+)"\) \{ \.\.\. on Blob/g)) {
      matched = true;
      data[alias] = { text: this.blobs.get(oid) ?? '', isTruncated: false };
    }
    for (const [, alias, path] of q.matchAll(/(commit_\d+): ref\(qualifiedName: \$branch\) \{ target \{ \.\.\. on Commit \{ history\(first: 1, path: "([^"]+)"\)/g)) {
      matched = true;
      data[alias] = {
        target: {
          history: {
            nodes: [
              {
                author: { name: 'Pizza Manager', email: 'manager@slowdoughpizza.example', user: { id: 1001, login: this.login } },
                committedDate: nowIso(),
              },
            ],
          },
        },
      };
      void path;
    }
    for (const [, alias, expr] of q.matchAll(/(file_\d+): object\(expression: "([^"]+)"\) \{ \.\.\. on Blob/g)) {
      matched = true;
      const idx = expr.indexOf(':');
      const branch = this.branches.get(expr.slice(0, idx));
      const content = branch?.files.get(expr.slice(idx + 1));
      data[alias] =
        content === undefined
          ? null
          : { oid: this.#blobSha(content), byteSize: Buffer.byteLength(content), isBinary: false, isTruncated: false, text: content };
    }
    for (const [, alias] of q.matchAll(/(history_\d+): ref\(qualifiedName: \$branch\)/g)) {
      matched = true;
      data[alias] = { target: { history: { nodes: [] } } };
    }
    for (const [, alias] of q.matchAll(/(commit_\d+): object\(oid: "[0-9a-f]+"\) \{ \.\.\. on Commit \{ (?:status|deployments|checkSuites)/g)) {
      matched = true;
      data[alias] = { status: null, deployments: { nodes: [] }, checkSuites: { nodes: [] } };
    }
    if (matched) return repo(data);

    this.record('unhandled.graphql', { query: q.slice(0, 200) });
    return { status: 200, body: { errors: [{ message: `mock: unhandled GraphQL query: ${q.slice(0, 120)}` }] } };
  }
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}
