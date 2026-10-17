# Slow Dough Pizza Co. — website + Sveltia CMS

A static marketing site (React 19 + Vite 8 + Tailwind 4) for a fictional pizzeria, with a hidden,
self-service **content editor** powered by [Sveltia CMS](https://sveltiacms.app/) so the shop
manager can update the Daily Menu, the Blog and the "Today's Dough" announcement without touching
code. Every change becomes a **pull request** that is reviewed and merged on GitHub; merging to
`main` automatically builds and deploys the site to **GitHub Pages**.

| | |
|---|---|
| Live site | https://smagara.github.io/SlowDoughPizzaSite_Sveltia/ |
| Content editor | https://smagara.github.io/SlowDoughPizzaSite_Sveltia/admin — **not linked from the site**; editors bookmark it (with or without a trailing slash) |
| Technical design | [`docs/Technical-Design-Document.docx`](docs/Technical-Design-Document.docx) |
| Manager guide | [`docs/Manager-Quick-Guide.pdf`](docs/Manager-Quick-Guide.pdf) |

## How it works

```
Staff ──edits──▶ /admin (Sveltia CMS, runs in the browser; unlinked URL, noindex)
                    │  GitHub API (signed-in collaborator only)
                    ▼
          branch cms/<collection>/<slug> ──▶ pull request → main      Drafts → In Review → Ready
                                                  │  PR check: validate content + build        (lanes in the editor)
                                                  │  CMS publish gate: status sveltia/workflow
                                                  │     pending while Draft / In Review (merge blocked)
                                     manager moves the card to "Ready" in the editor
                                                  ▼
                              gate squash-merges the PR → deploy workflow → GitHub Pages
```

Nobody has to open GitHub for a routine content change: the editor is the whole workflow, GitHub is
the audit trail (every change is a pull request with a diff, a check run and who moved it to Ready).
Developers still use ordinary pull requests for code; the gate waves those through.

* **Editable content** lives in plain files under [`content/`](content/): one JSON file per menu
  item (`menu-items/`) and per menu section (`menu-sections/`), `menu.json` (introduction),
  `announcement.json`, `hours.json`, and one Markdown file per blog post in `blog/`. The React
  components import them at build time through [`src/content/index.ts`](src/content/index.ts).
  Item-level files mean every change is its own pull request and its own card on the review
  board, labelled `Section › Item — $price`.
* **CMS configuration** is TypeScript, type-checked against Sveltia's schema: [`src/admin/config.ts`](src/admin/config.ts).
  The same field rules (required, lengths, regex patterns, options) are re-applied server-side by
  [`scripts/validate-content.ts`](scripts/validate-content.ts) in CI.
* **Workflows**: [`pr-check.yml`](.github/workflows/pr-check.yml) (every PR),
  [`cms-publish.yml`](.github/workflows/cms-publish.yml) (the publishing gate; logic in
  [`scripts/cms-publish-gate.mjs`](scripts/cms-publish-gate.mjs), unit-tested) and
  [`deploy.yml`](.github/workflows/deploy.yml) (push to `main` or dispatched by the gate).

### The editor URL is unlisted, not secret

Nothing on the public site links to `/admin/` and the page carries `noindex, nofollow`, so it is not
discoverable by visitors or well-behaved crawlers. It is still a public URL: anyone who guesses it
sees a sign-in page and nothing else — access is enforced by GitHub (collaborators only), not by
obscurity. Share the address with editors privately (no `robots.txt` entry on purpose: that would
advertise the path).

### Inside the editor

* **Preview pane** renders the page section being edited in the website's own look (menu cards,
  top banner and header, hours table, blog card + essay) and updates as you type
  (`src/admin/preview/`).
* **No media uploads.** The site has no image fields (artwork is inline SVG), so the Assets area is
  removed from the UI (`src/admin/theme.css`) and uploads are rejected outright
  (`media_libraries.default.config.max_file_size: 0` in `src/admin/config.ts`), even on the direct
  `#/assets` route.
* **Content-source check.** In GitHub mode the editor reads the repository's default branch *on
  GitHub*, not your working copy — a folder that exists locally but has not been pushed shows up
  as an empty collection. After sign-in the editor verifies that every configured content
  folder/file exists on that branch and, if not, shows a banner naming them
  (`src/admin/content-check.ts`). Local mode reads the working copy and is unaffected.
* **Sign-in is remembered.** After a successful sign-in the editor opens directly on the next visit;
  the login page — and with it the **Work with Local Repository** option on localhost — reappears
  after *Sign Out* (account menu, top right).

> **Updating a deployed site to a new version of this repo:** the editor's *GitHub* mode always
> reads the remote default branch. After pulling a version that adds or moves content files
> (v1.3 moved the menu into `content/menu-items/` and `content/menu-sections/`), push those files
> to `main` before testing GitHub mode — until then the affected collections are empty there and
> the editor's content-check banner tells you which folders are missing.

## Run locally

**Prerequisites:** Node.js ≥ 22.6

```bash
npm install
npm run dev          # http://localhost:3000  (site)  ·  http://localhost:3000/admin/  (editor)
```

### Local edit mode (no GitHub round-trip)

On `localhost` the editor's login page offers **Work with Local Repository** (Chrome/Edge — it uses
the File System Access API). Pick the repository folder; edits are written straight into
`content/` and the dev server hot-reloads the site. Commit them with git as usual. Nothing is sent
to GitHub in this mode, and no pull request is created.

Two things to know: the option only appears when the address bar says `localhost` or `127.0.0.1`
(not the LAN URL Vite also prints), and it is only on the *login page* — if you previously signed
in (local or GitHub) the editor reopens in that mode; choose **Sign Out** to get back to the login
page and pick the other mode.

### Other scripts

```bash
npm run build              # production build → dist/ (site + editor)
npm run preview            # serve dist/
npm run lint               # type-check (includes the CMS configuration)
npm run validate:content   # re-validate content/ with the CMS field rules (what CI runs)
npm run test:e2e           # offline end-to-end test of the editor + PR workflow (see below)
npm run check              # lint + validate + build
```

`npm run test:e2e` drives the real editor in headless Chromium against an in-process **simulated
GitHub API** (`tests/e2e/github-mock.mjs`) and a fake local file system, so the whole
branch → commit → pull request → "send for review" flow is verified without network access. It also
refreshes the screenshots in `docs/images/cms/`.

> **First run:** the Playwright *package* is installed by `npm install`, but the browser binary is
> not. Run `npm run test:e2e:setup` once (= `npx playwright install chromium`, ~150 MB); the test
> prints this hint if the browser is missing.

## One-time repository setup (owner)

0. **Default branch = `main`.** The editor edits the repository's *default* branch (Sveltia detects
   it), while the workflows build and deploy `main`. If the repository still uses `master`, rename
   it (*Settings → General → Default branch*) before going further.
1. **GitHub Pages** — *Settings → Pages → Build and deployment → Source:* **GitHub Actions**.
   The first push to `main` deploys the site.
2. **Editors** — add the manager as a **collaborator** with *Write* permission
   (*Settings → Collaborators*). Sveltia CMS only lets repository collaborators in; everyone
   else sees "You don't have access to the repository".
3. **Protect `main`** — *Settings → Branches (or Rules) → add rule for `main`*: require a pull
   request before merging; require the status checks **"Validate & build (PR)"** *and*
   **"sveltia/workflow"** (GitHub lists a status once it has been reported — open any PR first);
   block force pushes. Required approvals: **0** for the no-GitHub flow (the editor's *Ready* lane
   is the approval, optionally with `CMS_REQUIRE_SECOND_REVIEWER=true`); if you keep 1, the gate
   cannot merge and a developer merges on GitHub once the status is green. Also enable
   *Settings → General → Pull Requests → Automatically delete head branches*.
4. **Sign-in method** — choose one (both can be enabled):
   * **Personal access token (no infrastructure).** Works immediately. The manager creates a
     fine-grained token for this repository with *Contents: Read and write* and
     *Pull requests: Read and write* (the editor's sign-in dialog links to a pre-filled form)
     and pastes it once; it is stored in the browser.
   * **"Sign in with GitHub" (OAuth, recommended long-term).** GitHub Pages cannot keep an OAuth
     client secret, so deploy the official
     [Sveltia CMS Authenticator](https://github.com/sveltia/sveltia-cms-auth) to Cloudflare
     Workers (free): create a GitHub OAuth App (callback URL `https://<worker>.workers.dev/callback`),
     set the worker's `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and
     `ALLOWED_DOMAINS=smagara.github.io`, then add the repository **variable**
     `CMS_OAUTH_BASE_URL = https://<worker>.workers.dev` (*Settings → Secrets and variables →
     Actions → Variables*). The next deployment enables the button.

## Reviewing and publishing a content change

1. Staff save in the editor → a pull request such as `content: update Menu Item
   “margherita-verace-d-o-p”` appears from branch `cms/menu-items/margherita-verace-d-o-p` as a
   GitHub **draft** PR (label `sveltia-cms/draft`). **Send for Review** marks it ready for review and
   relabels it `sveltia-cms/pending_review`.
2. The **PR check** validates the content and builds the site. The **CMS publish gate** reports the
   commit status `sveltia/workflow` = *pending* ("In review in the content editor — move it to
   Ready to publish"); because that status is required by the branch rule, the PR **cannot be
   merged yet** — by anyone.
3. The manager opens the card in the editor's *In Review* lane, checks the preview and moves it to
   **Ready** (label `sveltia-cms/pending_publish`). The gate re-runs: status *success*,
   **squash-merge**, and the deploy workflow is dispatched. Two or three minutes later the site is
   live and the card has left the board. The gate comments on the PR who approved it.
4. If the PR check failed, the status is *failure* with a pointer to the log and nothing is merged;
   fix the entry in the editor (a new save re-runs everything).

Optional four-eyes rule: set the repository variable `CMS_REQUIRE_SECOND_REVIEWER=true` and the gate
refuses a Ready label applied by the same GitHub account that created the draft (GitHub's PR
timeline records who did what). Deletion requests (`sveltia-cms/pending_deletion`) are never
auto-merged; a developer merges those on GitHub. Developers can of course still merge any CMS PR
manually once its status is green.

### One pull request per entry — how the lanes map to GitHub

Sveltia's Editorial Workflow keeps *all* of its state in GitHub: a card on the board **is** an open
pull request, and the lane **is** the PR's label. Consequently:

| Editor action | GitHub |
|---|---|
| First **Save** of an entry | branch `cms/<collection>/<slug>` + commit + **draft** pull request (`sveltia-cms/draft`) |
| Further saves of the same entry | new commits on the same branch / PR |
| Move Draft → In Review ("Send for Review") | same PR: label → `sveltia-cms/pending_review`, draft → *ready for review* |
| Move back to Draft | same PR: label → `sveltia-cms/draft`, *converted to draft* |
| Move to **Ready** | same PR: label → `sveltia-cms/pending_publish`; the gate sets `sveltia/workflow` = success and **squash-merges** it; deploy runs; branch deleted; card disappears (= published) |
| Discard (↶ on the card) | PR closed, branch deleted |

A lane move never creates a second pull request (asserted by `npm run test:e2e`). A draft cannot
exist *without* a PR — that is where Sveltia stores it — so "only open the PR at the end" is not an
option with this CMS; the draft PR is the parking spot instead, and the `sveltia/workflow` status
keeps every Draft and In Review PR unmergeable until the editor says Ready.

## Developer workflow between content updates

Content PRs (`cms/…`) land on `main` continuously, so code work must start from a fresh `main`
and never be pushed to `main` directly. Short version (full procedure in the TDD §12.3):

```bash
git switch main && git pull --ff-only          # start from what is deployed
git switch -c fix/menu-badge-colour            # one branch per patch
# … edit, npm run check, npm run test:e2e …
git push -u origin HEAD                        # open a PR; the gate waves code PRs through once the PR check is green
```

* Nothing the tooling writes needs committing: `dist/`, `test-results/` (e2e screenshots) and
  `node_modules/` are git-ignored; the committed documentation screenshots only change when you run
  `UPDATE_SCREENSHOTS=1 npm run test:e2e` on purpose.
* `git pull --rebase` refuses to run with local modifications. Commit them to your branch or
  `git stash --include-untracked` first; `git config rebase.autoStash true` does that automatically.
* Changes to the **content model** (new/moved `content/` folders, renamed collections) ship code and
  content in the *same* PR, after the open CMS PRs have been published or discarded, and are
  tested in GitHub mode only after that PR is on `main` (the editor reads the remote branch).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| **Some collections show 0 entries in GitHub mode but are full in local mode** (e.g. Menu Items / Menu Sections after updating to v1.3). | The new `content/menu-items/` and `content/menu-sections/` folders exist in your working copy but not yet on the GitHub branch the editor reads. Commit and push (or merge) them to `main`, then reload. The editor now shows a *Content check* banner listing exactly which folders are missing on the branch. |
| `…/admin` without a trailing slash shows the website instead of the editor. | Fixed in v1.5: `public/admin.html` redirects to `admin/` (keeping any `#/…` route) and the dev server redirects `/admin` → `/admin/`. |
| The editor opens but **shows no existing content** — Blog Posts "0", Site Content files listed with empty fields, creating new items still works. | The editor is reading a branch that does not contain `content/`. Sveltia shows no error in this case. Check which branch holds `content/` on GitHub and make it the **default branch** (the editor follows the default branch; the deploy workflow publishes `main`, so that should be `main`). If the branch is right, clear a stale cache: sign out, then in the browser clear site data for the editor URL and sign in again. |
| "You don't have access to the repository." | The GitHub account is not a collaborator with write access. |
| "The branch has moved since the site data was loaded." | Someone committed to the branch meanwhile; reload the editor and redo the change. |
| A change is merged but the site did not update. | Check the *Deploy to GitHub Pages* run under *Actions*; the merge must land on `main` and Pages must be set to *GitHub Actions*. |
| `npm run build` prints "chunks are larger than 500 kB". | Expected for the editor entry (Sveltia CMS is a pre-built ~2 MB app; its sub-features are lazy chunks). `build.chunkSizeWarningLimit` is raised in `vite.config.ts` so the warning only fires for real regressions. |
| `npm run build` prints `[PLUGIN_TIMINGS] JavaScript callbacks ran for …`. | An informational diagnostic from Rolldown (Vite 8's bundler) about time spent in JavaScript plugins — it is not an error. The project's own plugins use hook filters so they only run for the files they handle; the remaining time is the React and Tailwind plugins. Profile with `node --cpu-prof` if it grows. |
| `npm run test:e2e` fails to start with a browser error. | Run `npm run test:e2e:setup` once. |
| After signing in: empty page, **"Collection not found."** and a Back button. | The URL names a collection that does not exist (e.g. a bookmark like `…/admin/#/collections/settings` from an earlier configuration). Since v1.3 the editor drops such a hash on load and opens the start page (a `[admin] Unknown collection in URL` line is logged). If it still happens, open the plain editor URL without `#…`. |
| Collection names clipped in the left sidebar ("Site Conte…") on a laptop-sized window. | Fixed in v1.3 (`src/admin/theme.css` gives the sidebar a minimum width). |
| The "SLOW DOUGH" wordmark overlaps the logo border (Windows). | Fixed in v1.3 (`textLength` in `public/admin/logo.svg` forces the text to fit regardless of font metrics). |
| "Work with Local Repository" is not offered any more. | You are still signed in from a previous session (the editor skips the login page), or the page was opened via a non-`localhost` address. Sign out from the account menu, or open `http://localhost:3000/admin/`. |
| The logo / login page looks odd in dark mode. | Fixed in v1.2 (the logo tile now has a light background and terracotta ring so it renders on both themes). Hard-refresh to pick up the new build. |

## Project layout

```
admin/index.html            entry of the hidden editor (→ dist/admin/)
content/                    CMS-managed content: menu-items/, menu-sections/, blog/ (one file each), menu/announcement/hours JSON
docs/                       design document, manager guide, screenshots
public/admin/logo.svg       editor logo / favicon
scripts/validate-content.ts CI content validator (rules come from src/admin/config.ts)
scripts/cms-publish-gate.mjs publishing gate used by cms-publish.yml (unit tests in tests/unit/)
src/admin/                  Sveltia CMS bootstrap, typed config, site-themed skin, preview/ templates, content-source check
src/components/             React UI (Markdown.tsx renders blog bodies safely; no link to the editor)
src/content/index.ts        typed loader for everything under content/
tests/e2e/                  offline end-to-end test + simulated GitHub API
tools/                      Vite plugins (Markdown front matter import, build-time CSP)
```

## Typography

Body text uses the system sans-serif font stack (including Segoe UI on Windows).
Headings and serif accents use Georgia, with Times New Roman as a fallback.
All fonts are local.

## AI Disclosure

This site was originally generated with AI assistance in Google AI Studio.
All details, phone numbers, addresses, the company name, etc. are completely fictionalized.

## License

This project is licensed under the [MIT License](./LICENSE).
