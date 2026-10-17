/**
 * Content-source check for GitHub mode.
 *
 * Sveltia silently shows an empty collection when the branch it reads on GitHub does not contain
 * the collection's folder or file — which has twice been mistaken for a CMS bug (a stale `main`
 * without content/, then a working copy with the new content/menu-items/ folders that had not
 * been pushed yet; local mode reads the working copy, GitHub mode reads the remote branch).
 *
 * After a GitHub sign-in this module asks GitHub (with the user's own token, same as Sveltia)
 * which branch it is reading and whether every configured folder/file exists there. Anything
 * missing is reported in a dismissible banner with concrete next steps, and in the console.
 * Never blocks the editor; any API failure is ignored.
 */
import type { CmsConfig } from '@sveltia/cms';

const USER_KEY = 'sveltia-cms.user';
const BANNER_ID = 'sd-content-check';

interface StoredUser {
  backendName?: string;
  token?: string;
}

const readUser = (): StoredUser | undefined => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) ?? '{}') as StoredUser;
  } catch {
    return undefined;
  }
};

/** Paths the configuration expects in the repository, with the collection that needs them. */
export const expectedPaths = (config: CmsConfig): { path: string; label: string }[] => {
  const out: { path: string; label: string }[] = [];
  for (const c of config.collections ?? []) {
    if ('divider' in c) continue;
    const label = c.label ?? c.name;
    if ('folder' in c && typeof c.folder === 'string') out.push({ path: c.folder.replace(/^\/+|\/+$/g, ''), label });
    if ('files' in c) for (const f of c.files) out.push({ path: f.file.replace(/^\/+/, ''), label: `${label} › ${f.label ?? f.name}` });
  }
  return out;
};

const showBanner = (branch: string, missing: { path: string; label: string }[]) => {
  document.getElementById(BANNER_ID)?.remove();
  const el = document.createElement('aside');
  el.id = BANNER_ID;
  el.setAttribute('role', 'status');
  const list = missing.map((m) => `${m.path} (${m.label})`).join(', ');
  el.innerHTML = `
    <strong>Content check:</strong> the GitHub branch <code>${branch}</code> does not contain
    <code class="sd-missing"></code>, so those collections look empty here although they may exist
    in your working copy. Commit and push (or merge) those files to <code>${branch}</code>, then reload.
    Local mode reads your working copy instead.
    <button type="button" aria-label="Dismiss">✕</button>`;
  el.querySelector('.sd-missing')!.textContent = list;
  el.querySelector('button')!.addEventListener('click', () => el.remove());
  document.body.appendChild(el);
};

/**
 * Run the check once the user is signed in with GitHub. Resolves with the list of missing paths
 * (empty when everything is present), mainly for tests.
 */
export async function checkContentSource(config: CmsConfig, { timeoutMs = 60000 } = {}): Promise<{ path: string; label: string }[]> {
  const backend = config.backend;
  if (backend.name !== 'github') return [];

  // Wait for a GitHub sign-in (token appears in local storage); give up quietly otherwise.
  const started = Date.now();
  let user = readUser();
  while (!(user?.backendName === 'github' && user.token)) {
    if (Date.now() - started > timeoutMs) return [];
    await new Promise((r) => setTimeout(r, 1000));
    user = readUser();
  }

  const apiRoot = (backend.api_root ?? 'https://api.github.com').replace(/\/+$/, '');
  const headers = { Authorization: `token ${user.token}`, Accept: 'application/vnd.github+json' };
  const get = (path: string) => fetch(`${apiRoot}${path}`, { headers, cache: 'no-cache' });

  try {
    const branch = backend.branch ?? ((await (await get(`/repos/${backend.repo}`)).json()) as { default_branch?: string }).default_branch;
    if (!branch) return [];
    const missing: { path: string; label: string }[] = [];
    for (const item of expectedPaths(config)) {
      const res = await get(`/repos/${backend.repo}/contents/${item.path}?ref=${encodeURIComponent(branch)}`);
      if (res.status === 404) missing.push(item);
    }
    if (missing.length) {
      console.warn(`[admin] Content check: branch "${branch}" on GitHub is missing ${missing.map((m) => m.path).join(', ')}`);
      showBanner(branch, missing);
    } else {
      console.info(`[admin] Content check: all ${expectedPaths(config).length} content paths exist on branch "${branch}".`);
    }
    return missing;
  } catch (error) {
    console.debug('[admin] Content check skipped', error);
    return [];
  }
}
