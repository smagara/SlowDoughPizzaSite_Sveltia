/**
 * Offline end-to-end test of the Sveltia CMS integration.
 *
 * What it proves (with the real production config and the real Sveltia bundle):
 *   1. The hidden editor loads, is themed, and offers local + GitHub sign-in.
 *   2. Only repository collaborators get in (a non-collaborator is rejected).
 *   3. Editing a menu item and saving creates a feature branch `cms/menu-items/<slug>`, a commit
 *      and a *draft* pull request against `main`; "Send for Review" marks it ready + labels it;
 *      moving between workflow lanes only relabels that same PR; the workflow card reads
 *      "Section › Item — $price".
 *   4. Script/HTML characters in free-text fields are rejected by the form validation.
 *   5. Creating a blog post writes a Markdown file with YAML front matter that the site build can
 *      parse and that passes the CI content validator.
 *   6. "Work with Local Repository" mode writes straight to the working copy (no GitHub).
 *   7. The production build works when served from the GitHub Pages URL (base path, CSP, no link
 *      to /admin/ anywhere on the public page, no "local repository" option outside localhost).
 *   8. The preview pane renders the site-styled templates; the Assets (media upload) UI is hidden
 *      and uploads are rejected even on the direct /assets route.
 *   9. A stale URL naming a collection that no longer exists (#/collections/settings) opens the
 *      start page instead of "Collection not found".
 *  10. When the GitHub branch lacks a configured content folder (e.g. content/menu-items not yet
 *      pushed) the editor shows a content-check banner naming the folders; never otherwise.
 *
 * GitHub's API is simulated in-process (github-mock.mjs) and wired in via Playwright request
 * interception, so no network, tokens or real repository are needed. Screenshots are written to
 * test-results/screenshots/ (git-ignored); with UPDATE_SCREENSHOTS=1 they refresh docs/images/cms/,
 * which the Technical Design Document and the manager guide reuse.
 *
 *   npm run test:e2e            (requires a Playwright Chromium: `npx playwright install chromium`)
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname } from 'node:path';
import { join, relative, resolve } from 'node:path';
import { chromium } from 'playwright';
import { build, createServer } from 'vite';
import { GitHubMock } from './github-mock.mjs';
import { parseMarkdownFile } from '../../tools/vite-plugin-markdown-content.ts';

const root = resolve(import.meta.dirname, '../..');
// Screenshots go to the git-ignored test-results/ folder so that running the test never dirties
// the working tree. Set UPDATE_SCREENSHOTS=1 to refresh the committed documentation images.
const shotsDir = process.env.UPDATE_SCREENSHOTS === '1' ? join(root, 'docs/images/cms') : join(root, 'test-results/screenshots');
mkdirSync(shotsDir, { recursive: true });

const OWNER = 'smagara';
const REPO = 'SlowDoughPizzaSite_Sveltia';
const HEADLESS = process.env.HEADED !== '1';

// ---------------------------------------------------------------------------------- helpers
const results = [];
async function test(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✔ ${name} (${Date.now() - started} ms)`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.log(`  ✖ ${name}\n    ${error.stack ?? error}`);
  }
}

function seedFiles() {
  const seed = {};
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else seed[relative(root, p).replaceAll('\\', '/')] = readFileSync(p, 'utf8');
    }
  };
  walk(join(root, 'content'));
  seed['package.json'] = readFileSync(join(root, 'package.json'), 'utf8');
  seed['.git/HEAD'] = 'ref: refs/heads/main\n';
  return seed;
}

/** Create a browser context whose api.github.com traffic is answered by the mock. */
async function githubContext(browser, mock) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  await ctx.route('https://api.github.com/**', async (route) => {
    const req = route.request();
    const res = mock.handle({ method: req.method(), url: req.url(), headers: req.headers(), body: req.postData() });
    const headers = { 'access-control-allow-origin': '*', ...(res.headers ?? {}) };
    if (res.raw) return route.fulfill({ status: res.status, headers, body: res.body });
    return route.fulfill({
      status: res.status,
      headers: { 'content-type': 'application/json', ...headers },
      body: res.body === undefined ? '' : JSON.stringify(res.body),
    });
  });
  await ctx.route('https://www.githubstatus.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":{"indicator":"none"}}' }),
  );
  return ctx;
}

async function openEditor(ctx, baseUrl) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('    [page error]', e.message));
  await page.goto(`${baseUrl}/admin/`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Work with Local Repository' }).waitFor();
  return page;
}

async function signInWithToken(page) {
  await page.getByRole('button', { name: 'Sign In Using Access Token' }).click();
  await page.getByLabel('Personal Access Token').fill('ghp_simulated_token');
  await page.getByRole('button', { name: /^Sign In$/ }).click();
}

/** Expand every (nested) collapsed list in the entry editor. */
async function expandAll(page) {
  for (let i = 0; i < 6; i++) {
    let clicked = false;
    for (const b of await page.getByRole('button', { name: 'Expand All' }).all()) {
      if (await b.isEnabled()) {
        await b.click();
        clicked = true;
      }
    }
    await page.waitForTimeout(250);
    if (!clicked) break;
  }
}

const shot = (page, name) => page.screenshot({ path: join(shotsDir, `${name}.png`) });

/** The preview pane is an iframe that mounts slightly after the form — wait for it. */
async function previewFrame(page) {
  let frame;
  await until(() => (frame = page.frames().find((f) => f !== page.mainFrame())) !== undefined, 'preview iframe');
  await frame.locator('.sd-frame').waitFor({ timeout: 20000 });
  return frame;
}

/** Poll until `fn()` is truthy (used for side effects in the simulated GitHub API). */
async function until(fn, what, timeout = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timed out waiting for: ${what}`);
}

// ---------------------------------------------------------------------------------- run
// Pretend the OAuth helper is configured so the login page shows the "Sign In with GitHub"
// button the manager will see in production (the button itself is never clicked here).
process.env.VITE_CMS_OAUTH_BASE_URL ||= 'https://sveltia-cms-auth.example.workers.dev';

console.log('Starting Vite dev server…');
const vite = await createServer({ root, configFile: join(root, 'vite.config.ts'), server: { port: 3210, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
await vite.listen();
const baseUrl = `http://127.0.0.1:${vite.config.server.port}`;
console.log(`Site: ${baseUrl}\n`);

let browser;
try {
  browser = await chromium.launch({ headless: HEADLESS });
} catch (error) {
  await vite.close();
  console.error(`\nCould not launch Chromium: ${error.message.split('\n')[0]}`);
  console.error('Install the Playwright browser once with:  npm run test:e2e:setup   (= npx playwright install chromium)\n');
  process.exit(2);
}

try {
  // ------------------------------------------------------------------ 1. login page
  await test('hidden editor page loads with local + GitHub sign-in options', async () => {
    const mock = new GitHubMock({ owner: OWNER, repo: REPO, rootDir: root, include: ['content'] });
    const ctx = await githubContext(browser, mock);
    const page = await openEditor(ctx, baseUrl);
    await assert.doesNotReject(page.getByRole('button', { name: /Sign In with .*GitHub/ }).waitFor());
    assert.equal(await page.title(), 'Slow Dough Pizza Co. — Content Editor');
    // Site theme applied (terracotta accent)
    const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sui-primary-accent-color').trim());
    assert.equal(accent, '#c85a32');
    await shot(page, '01-login');
    await ctx.close();
  });

  // ------------------------------------------------------------------ 2. authorization
  await test('a GitHub user who is not a repository collaborator is rejected', async () => {
    const mock = new GitHubMock({ owner: OWNER, repo: REPO, rootDir: root, include: ['content'], login: 'random-stranger', collaborators: ['pizza-manager'] });
    const ctx = await githubContext(browser, mock);
    const page = await openEditor(ctx, baseUrl);
    await signInWithToken(page);
    await page.getByText(/not a collaborator|don’t have access|no access|cannot access|do not have access/i).first().waitFor({ timeout: 15000 });
    await shot(page, '02-not-a-collaborator');
    await ctx.close();
  });

  // ------------------------------------------------------------------ 3. menu → PR
  await test('editing a menu item creates a feature branch + pull request; lane moves relabel the same PR; card shows Section › Item', async () => {
    const mock = new GitHubMock({ owner: OWNER, repo: REPO, rootDir: root, include: ['content'] });
    const ctx = await githubContext(browser, mock);
    const page = await openEditor(ctx, baseUrl);
    await signInWithToken(page);
    await page.getByText('Collections', { exact: true }).waitFor();
    await page.waitForTimeout(800);
    assert.match(page.url(), /#\/collections\/menu-items$/, 'editor opens on the Menu Items list');
    await shot(page, '03-collections');

    await page.getByText('Site Content', { exact: true }).first().click();
    await page.waitForTimeout(500);
    await shot(page, '04-site-content');

    await page.goto(`${baseUrl}/admin/#/collections/menu-items/entries/margherita-verace-d-o-p`);
    await page.getByText('Italian name', { exact: true }).waitFor();
    await page.waitForTimeout(800);
    await shot(page, '05-menu-editor');

    // Site-styled preview template (rendered inside the preview iframe)
    const preview = await previewFrame(page);
    assert.match(await preview.locator('.sd-h3').first().innerText(), /Neapolitan Pizzas/);
    assert.equal(await preview.locator('.sd-card-highlight').count(), 1, 'item card rendered');

    const price = page.getByLabel('Price (USD)').locator('input').first();
    assert.equal(await price.inputValue(), '19'); // Margherita Verace
    await price.fill('21');
    await page.waitForTimeout(400);
    assert.match(await preview.locator('.sd-price').first().innerText(), /21/, 'preview follows the price');
    await shot(page, '06-menu-price-edited');

    await page.getByRole('button', { name: 'Save' }).click();
    const dialog = page.getByRole('button', { name: 'Send for Review' });
    await dialog.waitFor({ timeout: 20000 });
    await shot(page, '07-send-for-review');

    // Branch + commit + draft PR exist before the user decides to send for review
    assert.deepEqual(
      mock.log.map((l) => l.kind),
      ['branch.create', 'commit', 'pull.create', 'labels.add'],
    );
    const BRANCH = 'cms/menu-items/margherita-verace-d-o-p';
    assert.equal(mock.log[0].branch, BRANCH);
    assert.deepEqual(mock.log[1].additions, ['content/menu-items/margherita-verace-d-o-p.json']);
    assert.equal(mock.log[2].base, 'main');
    assert.equal(mock.log[2].draft, true);
    assert.deepEqual(mock.log[3].labels, ['sveltia-cms/draft']);

    await dialog.click();
    await until(() => mock.pulls[0]?.labels.includes('sveltia-cms/pending_review') && !mock.pulls[0].draft, 'PR marked ready for review');
    await page.getByText('In Review', { exact: true }).first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(600);
    await shot(page, '08-entry-in-review');

    const pr = mock.pulls[0];
    assert.equal(pr.draft, false, 'PR is marked ready for review');
    assert.deepEqual(pr.labels, ['sveltia-cms/pending_review']);
    assert.equal(pr.head, BRANCH);
    assert.equal(pr.title, 'content: update Menu Item “margherita-verace-d-o-p”');
    assert.equal(
      mock.branches.get('main').files.get('content/menu-items/margherita-verace-d-o-p.json'),
      readFileSync(join(root, 'content/menu-items/margherita-verace-d-o-p.json'), 'utf8'),
      'main is untouched',
    );

    // The committed JSON is well-formed, field-ordered, and the computed review label follows the price
    const committed = mock.branches.get(BRANCH).files.get('content/menu-items/margherita-verace-d-o-p.json');
    const json = JSON.parse(committed);
    assert.equal(json.price, 21);
    assert.equal(typeof json.price, 'number');
    assert.equal(json.label, 'Neapolitan Pizzas (Pizze Nap… › Margherita Verace D.O.P. — $21');
    assert.deepEqual(Object.keys(json), ['name', 'label', 'section', 'italianName', 'description', 'price', 'tags', 'order', 'visible'], 'key order matches the committed files (clean diffs)');

    // Moving between lanes (In Review → Draft → In Review) relabels the SAME pull request
    await page.goto(`${baseUrl}/admin/#/collections/menu-items/entries/margherita-verace-d-o-p`);
    await page.getByText('Italian name', { exact: true }).waitFor();
    const statusButton = page.getByRole('button', { name: /Status/ });
    await statusButton.waitFor({ timeout: 20000 });
    for (const [status, label, expected] of [[/Draft/, /Status:\W*Draft/, 2], [/In Review/, /Status:\W*In Review/, 3]]) {
      // The control is disabled while the previous relabel request is in flight — wait for it.
      await until(async () => !(await statusButton.isDisabled()), 'status control enabled');
      await statusButton.click();
      const option = page.getByRole('menuitemradio', { name: status });
      await option.waitFor({ timeout: 10000 });
      await option.click();
      await until(() => mock.log.filter((l) => l.kind === 'labels.set').length >= expected, `lane move to ${status} recorded`);
      await until(async () => label.test(await statusButton.innerText()), `header shows ${label}`); // text contains Unicode isolates
    }
    assert.equal(mock.pulls.length, 1, 'still exactly one pull request');
    assert.equal(mock.log.filter((l) => l.kind === 'pull.create').length, 1, 'no second PR was created by lane moves');
    assert.deepEqual(mock.pulls[0].labels, ['sveltia-cms/pending_review']);

    // No media uploads: Assets navigation + toolbar button + "+" menu item are hidden
    assert.equal(await page.locator('button[aria-label="Assets"]:visible').count(), 0, 'Assets nav hidden');
    // Branch is complete → no content-check banner
    assert.equal(await page.locator('#sd-content-check').count(), 0, 'no content-check banner when all folders exist');

    // Workflow board: the card names the section, the item and the new price; no "Publish" control for editors
    await page.goto(`${baseUrl}/admin/#/workflow`);
    await page.getByText('In Review', { exact: true }).first().waitFor();
    await page.waitForTimeout(600);
    await shot(page, '09-workflow-board');
    const card = await page.locator('.card').first().innerText();
    assert.match(card, /Menu Item/);
    assert.match(card, /Neapolitan Pizzas/);
    assert.match(card, /Margherita Verace D\.O\.P\. — \$21/);
    assert.equal(await page.getByRole('button', { name: /^Publish/ }).count(), 0);
    await ctx.close();
  });

  // ------------------------------------------------------------------ 4. validation
  await test('script / HTML characters in free text are rejected before anything is sent to GitHub', async () => {
    const mock = new GitHubMock({ owner: OWNER, repo: REPO, rootDir: root, include: ['content'] });
    const ctx = await githubContext(browser, mock);
    const page = await openEditor(ctx, baseUrl);
    await signInWithToken(page);
    await page.getByText('Collections', { exact: true }).waitFor();
    await page.goto(`${baseUrl}/admin/#/collections/blog/new`);
    await page.getByText('Excerpt', { exact: true }).waitFor();

    await page.getByLabel('Title').locator('input').first().fill('Harvest Special <script>alert(1)</script>');
    await page.getByLabel('Excerpt').locator('textarea').first().fill('A short teaser for the autumn harvest pizza special.');
    const editor = page.locator('[contenteditable="true"]').first();
    await editor.click();
    await page.keyboard.type('Our autumn special is here. <img src=x onerror=alert(1)> Enjoy!');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByText('Angle brackets < and > are not allowed').waitFor();
    await page.getByText('HTML tags (e.g. <script>, <div>) are not allowed').waitFor();
    await page.getByText(/fields? have errors|field has an error/).waitFor();
    await shot(page, '10-validation-errors');
    assert.equal(mock.log.length, 0, 'nothing was committed');
    await ctx.close();
  });

  // ------------------------------------------------------------------ 5. blog post
  await test('creating a blog post commits valid Markdown + front matter on its own branch', async () => {
    const mock = new GitHubMock({ owner: OWNER, repo: REPO, rootDir: root, include: ['content'] });
    const ctx = await githubContext(browser, mock);
    const page = await openEditor(ctx, baseUrl);
    await signInWithToken(page);
    await page.getByText('Collections', { exact: true }).waitFor();
    await page.goto(`${baseUrl}/admin/#/collections/blog`);
    await page.getByRole('button', { name: 'New' }).first().waitFor();
    await page.waitForTimeout(500);
    await shot(page, '11-blog-list');
    await page.goto(`${baseUrl}/admin/#/collections/blog/new`);
    await page.getByText('Excerpt', { exact: true }).waitFor();

    await page.getByLabel('Title').locator('input').first().fill('Harvest Special: Pumpkin & Sage');
    await page.getByLabel('Subtitle').locator('input').first().fill('A limited autumn pie, available while the squash lasts.');
    await page.getByLabel('Excerpt').locator('textarea').first().fill('Roasted pumpkin, brown butter, crispy sage and smoked scamorza on our 72-hour dough.');
    await page.getByRole('button', { name: /Add .*Takeaway/ }).click();
    await page.getByLabel('Takeaway').locator('input').last().fill('Available Wednesday to Sunday until the end of November.');
    // Write the body in the editor's raw Markdown mode ("Edit in Markdown" toolbar button) with a
    // single fill(): simulated keystrokes in the rich-text editor race against its own "## "
    // heading conversion on slower machines and can drop characters, which made this scenario
    // flaky. Rich-text mode is still covered by scenario 4 (validation) and by the screenshot.
    const BODY = [
      '## Why pumpkin?',
      '',
      'Autumn squash roasts beautifully in a 900°F hearth, turning sweet and smoky in under two minutes.',
      '',
      '> Brown butter and sage were made for each other.',
      '',
      'Ask for it by name at the counter.',
    ].join('\n');
    const rawToggle = page.getByRole('button', { name: 'Edit in Markdown' }); // the only Markdown field on the form
    await rawToggle.click();
    const raw = page.getByLabel('Essay', { exact: true }).and(page.locator('textarea'));
    await raw.waitFor();
    await raw.fill(BODY);
    await rawToggle.click(); // back to rich text so the screenshot shows the WYSIWYG editor
    await page.waitForTimeout(400);
    await shot(page, '12-blog-editor');

    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'Send for Review' }).click();
    await until(() => mock.pulls[0]?.labels.includes('sveltia-cms/pending_review'), 'blog PR sent for review');

    const branch = 'cms/blog/harvest-special-pumpkin-sage';
    assert.ok(mock.branches.has(branch), `branch ${branch} exists`);
    const path = 'content/blog/harvest-special-pumpkin-sage.md';
    const md = mock.branches.get(branch).files.get(path);
    assert.ok(md, 'markdown file committed');
    const parsed = parseMarkdownFile(md, path);
    assert.equal(parsed.frontmatter.title, 'Harvest Special: Pumpkin & Sage');
    assert.equal(parsed.frontmatter.artType, 'dough');
    assert.match(String(parsed.frontmatter.date), /^\d{4}-\d{2}-\d{2}$/);
    assert.deepEqual(parsed.frontmatter.keyTakeaways, ['Available Wednesday to Sunday until the end of November.']);
    assert.ok(parsed.body.startsWith('## Why pumpkin?'), `heading written as Markdown:
${parsed.body}`);
    assert.ok(parsed.body.includes('> Brown butter'), 'quote written as Markdown');
    assert.equal(mock.pulls[0].title, 'content: add Blog Post “harvest-special-pumpkin-sage”');
    await ctx.close();
  });

  // ------------------------------------------------------------------ 6. announcement
  await test('the dough announcement banner is editable', async () => {
    const mock = new GitHubMock({ owner: OWNER, repo: REPO, rootDir: root, include: ['content'] });
    const ctx = await githubContext(browser, mock);
    const page = await openEditor(ctx, baseUrl);
    await signInWithToken(page);
    await page.getByText('Collections', { exact: true }).waitFor();
    await page.goto(`${baseUrl}/admin/#/collections/site/entries/dough-announcement`);
    await page.getByText('Headline', { exact: true }).waitFor();
    const headline = page.getByLabel('Headline').locator('input').first();
    await headline.fill("Today's Dough: 96-Hour Extended Ferment");
    await page.waitForTimeout(600);
    const preview = await previewFrame(page);
    await until(async () => /96-Hour Extended Ferment/.test(await preview.locator('.sd-banner').innerText().catch(() => '')), 'preview updates live');
    await shot(page, '13-announcement-editor');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'Send for Review' }).click();
    await until(() => mock.pulls[0]?.labels.includes('sveltia-cms/pending_review'), 'announcement PR sent for review');
    const json = JSON.parse(mock.branches.get('cms/site/dough-announcement').files.get('content/announcement.json'));
    assert.equal(json.headline, "Today's Dough: 96-Hour Extended Ferment");

    // Even the direct /assets route cannot upload anything (media library max_file_size: 0)
    await page.goto(`${baseUrl}/admin/#/assets`);
    await page.reload({ waitUntil: 'networkidle' }); // hash-only navigation out of an open entry is not a full route change
    const fileInput = page.locator('input[type=file]').first();
    await fileInput.waitFor({ state: 'attached' });
    await fileInput.setInputFiles({ name: 'photo.txt', mimeType: 'text/plain', buffer: Buffer.from('not allowed') });
    await page.getByText(/maximum size of .?.?0.? bytes/).waitFor(); // Unicode isolates around the number
    assert.equal(await page.getByRole('button', { name: 'Upload', exact: true }).last().isDisabled(), true, 'Upload button disabled');
    assert.equal(mock.log.filter((l) => l.kind === 'commit' && l.additions.some((a) => a.startsWith('public/uploads'))).length, 0, 'no upload committed');
    await ctx.close();
  });

  // ------------------------------------------------------------------ 7. local mode
  await test('"Work with Local Repository" writes directly to the working copy (dev mode)', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    const polyfill = readFileSync(join(root, 'tests/e2e/fake-file-system.js'), 'utf8');
    await ctx.addInitScript({ content: `${polyfill}\ninstallFakeFileSystem(${JSON.stringify(seedFiles())});` });
    await ctx.route('https://www.githubstatus.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"status":{"indicator":"none"}}' }));
    await ctx.route('https://api.github.com/**', (r) => r.abort()); // must never be called in local mode
    const page = await openEditor(ctx, baseUrl);
    await page.getByRole('button', { name: 'Work with Local Repository' }).click();
    await page.getByText('Collections', { exact: true }).waitFor();
    await page.goto(`${baseUrl}/admin/#/collections/site/entries/opening-hours`);
    await page.getByText('Weekly schedule', { exact: true }).waitFor();
    await expandAll(page);
    await page.waitForTimeout(300);
    await shot(page, '14-local-mode-hours');
    // Fields of off-screen list items are rendered lazily (content-visibility) — scroll the edit
    // pane until all 7 days × 3 text inputs exist, then pick Wednesday's "Hours" input.
    const inputs = page.locator('input[aria-labelledby]');
    await page.mouse.move(300, 500);
    for (let i = 0; i < 20 && (await inputs.count()) < 21; i++) {
      await page.mouse.wheel(0, 600);
      await page.waitForTimeout(250);
    }
    const labels = await inputs.evaluateAll((els) => els.map((el) => document.getElementById(el.getAttribute('aria-labelledby'))?.textContent.trim()));
    const hoursIndexes = labels.map((l, i) => (l === 'Hours' ? i : -1)).filter((i) => i >= 0);
    assert.equal(hoursIndexes.length, 7, 'seven days rendered');
    const wednesday = inputs.nth(hoursIndexes[2]);
    await wednesday.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    assert.equal(await wednesday.inputValue(), '4:30 PM – 9:30 PM');
    await wednesday.fill('5:00 PM – 9:30 PM');
    await page.getByRole('button', { name: 'Save' }).click();
    await until(async () => (await page.evaluate(() => window.__fakeFs.get('content/hours.json'))).includes('5:00 PM'), 'hours.json written to the working copy');
    const written = JSON.parse(await page.evaluate(() => window.__fakeFs.get('content/hours.json')));
    assert.equal(written.days[2].hours, '5:00 PM – 9:30 PM');
    assert.equal(written.days.length, 7);
    await ctx.close();
  });
  // ------------------------------------------------------------------ 8. production build
  await test('production build served at the GitHub Pages URL: base path, CSP, no link to the editor, no local mode', async () => {
    const PAGES_ORIGIN = 'https://smagara.github.io';
    const BASE = `/${REPO}/`;
    process.env.BASE_PATH = BASE;
    await build({ root, configFile: join(root, 'vite.config.ts'), logLevel: 'error' });
    delete process.env.BASE_PATH;

    const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.png': 'image/png' };
    const mock = new GitHubMock({ owner: OWNER, repo: REPO, rootDir: root, include: ['content'] });
    const ctx = await githubContext(browser, mock);
    await ctx.route(`${PAGES_ORIGIN}/**`, (route) => {
      const { pathname } = new URL(route.request().url());
      if (!pathname.startsWith(BASE)) return route.fulfill({ status: 404, body: 'not found' });
      let file = join(root, 'dist', pathname.slice(BASE.length));
      if (pathname.endsWith('/')) file = join(file, 'index.html');
      else if (!extname(file) && existsSync(`${file}.html`)) file = `${file}.html`; // GitHub Pages serves /admin from admin.html
      if (!existsSync(file)) return route.fulfill({ status: 404, body: `not found: ${pathname}` });
      return route.fulfill({ status: 200, headers: { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' }, body: readFileSync(file) });
    });

    // Public site
    const page = await ctx.newPage();
    const cspViolations = [];
    page.on('console', (m) => { if (/Content Security Policy|Refused to/.test(m.text())) cspViolations.push(m.text()); });
    await page.goto(`${PAGES_ORIGIN}${BASE}`, { waitUntil: 'networkidle' });
    await page.getByText('Time is our primary ingredient.').waitFor();
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    assert.match(csp ?? '', /script-src 'self'/);
    assert.deepEqual(cspViolations, [], 'no CSP violations on the public site');
    // The editor must not be discoverable from the public page: no link, no reference in the HTML
    assert.equal(await page.locator('a[href*="admin"]').count(), 0, 'no link to the editor');
    assert.ok(!(await page.content()).includes('/admin'), 'no reference to /admin in the rendered page');
    assert.ok(!readFileSync(join(root, 'dist/index.html'), 'utf8').includes('admin'), 'no reference to admin in dist/index.html');
    assert.ok(/noindex/.test(readFileSync(join(root, 'dist/admin/index.html'), 'utf8')), 'editor page is noindex');

    // Editor URL without the trailing slash (as people type/bookmark it) lands on the editor, hash preserved
    await page.goto(`${PAGES_ORIGIN}${BASE}admin#/workflow`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Sign In with .*GitHub/ }).waitFor();
    assert.equal(page.url(), `${PAGES_ORIGIN}${BASE}admin/#/workflow`, '/admin redirects to /admin/ keeping the route');

    // Editor at the production URL
    await page.goto(`${PAGES_ORIGIN}${BASE}admin/`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Sign In with .*GitHub/ }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Work with Local Repository' }).count(), 0, 'local mode only offered on localhost');
    assert.ok(await page.locator('img[src$="/SlowDoughPizzaSite_Sveltia/admin/logo.svg"]').count() > 0, 'logo uses the base path');
    await shot(page, '16-production-login');
    await signInWithToken(page);
    await page.getByText('Collections', { exact: true }).waitFor();
    await page.waitForTimeout(600);
    await shot(page, '17-production-collections');
    await ctx.close();
  });
  // ------------------------------------------------------------------ 9. stale route guard
  await test('a stale URL naming an unknown collection opens the start page instead of "Collection not found"', async () => {
    const mock = new GitHubMock({ owner: OWNER, repo: REPO, rootDir: root, include: ['content'] });
    const ctx = await githubContext(browser, mock);
    const page = await ctx.newPage();
    const warnings = [];
    page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });
    await page.goto(`${baseUrl}/admin/#/collections/settings`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Work with Local Repository' }).waitFor();
    assert.equal(new URL(page.url()).hash, '', 'stale hash removed before the CMS routed');
    assert.ok(warnings.some((w) => w.includes('Unknown collection in URL')), 'breadcrumb logged');
    await signInWithToken(page);
    await page.getByText('Collections', { exact: true }).waitFor();
    await page.waitForTimeout(600);
    assert.match(page.url(), /#\/collections\/menu-items$/);
    assert.equal(await page.getByText('Collection not found').count(), 0);
    await ctx.close();
  });
  // ------------------------------------------------------------------ 10. content-source check
  await test('a GitHub branch without the menu folders shows 0 entries AND a content-check banner naming them', async () => {
    // "main" as it was before v1.3: blog posts + the three single-file JSONs, no menu-items/ or menu-sections/
    const mock = new GitHubMock({ owner: OWNER, repo: REPO, rootDir: root, include: ['content/blog', 'content/menu.json', 'content/announcement.json', 'content/hours.json'] });
    const ctx = await githubContext(browser, mock);
    const page = await openEditor(ctx, baseUrl);
    await signInWithToken(page);
    await page.getByText('Collections', { exact: true }).waitFor();
    const banner = page.locator('#sd-content-check');
    await banner.waitFor({ timeout: 20000 });
    const text = (await banner.innerText()).replace(/\s+/g, ' ');
    assert.match(text, /branch main does not contain/);
    assert.match(text, /content\/menu-items \(Menu Items\)/);
    assert.match(text, /content\/menu-sections \(Menu Sections\)/);
    assert.doesNotMatch(text, /content\/blog/, 'existing folders are not reported');
    await shot(page, '18-content-check-banner');
    await banner.getByRole('button', { name: 'Dismiss' }).click();
    assert.equal(await banner.count(), 0, 'banner can be dismissed');
    await ctx.close();
  });
} finally {
  await browser.close();
  await vite.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} scenarios passed`);
if (failed.length) process.exit(1);
