# Slow Dough Pizza Co. — website + Sveltia CMS

A static marketing site (React 19 + Vite 8 + Tailwind 4) for a fictional pizzeria, with a hidden,
self-service **content editor** powered by [Sveltia CMS](https://sveltiacms.app/) so the shop
manager can update the Daily Menu, the Blog and the "Today's Dough" announcement without touching
code. Every change becomes a **pull request** that is reviewed and merged on GitHub; merging to
`main` automatically builds and deploys the site to **GitHub Pages**.

| | |
|---|---|
| Live site | https://smagara.github.io/SlowDoughPizzaSite_Sveltia/ |
| Content editor | https://smagara.github.io/SlowDoughPizzaSite_Sveltia/admin/ (hidden ✎ link in the footer) |
| Technical design | [`docs/Technical-Design-Document.docx`](docs/Technical-Design-Document.docx) |
| Manager guide | [`docs/Manager-Quick-Guide.pdf`](docs/Manager-Quick-Guide.pdf) |

## How it works

```
Manager ──edits──▶ /admin/ (Sveltia CMS, runs in the browser)
                      │  GitHub API (signed-in collaborator only)
                      ▼
            branch cms/<collection>/<slug>  ──▶  Pull request → main   (draft → "In review")
                                                      │  PR check: validate content + build
                                            reviewer approves & merges
                                                      ▼
                                      GitHub Action: validate → build → deploy to Pages
```

* **Editable content** lives in plain files under [`content/`](content/):
  `menu.json`, `announcement.json`, `hours.json` and one Markdown file per blog post in `content/blog/`.
  The React components import them at build time through [`src/content/index.ts`](src/content/index.ts).
* **CMS configuration** is TypeScript, type-checked against Sveltia's schema: [`src/admin/config.ts`](src/admin/config.ts).
  The same field rules (required, lengths, regex patterns, options) are re-applied server-side by
  [`scripts/validate-content.ts`](scripts/validate-content.ts) in CI.
* **Workflows**: [`.github/workflows/pr-check.yml`](.github/workflows/pr-check.yml) (every PR) and
  [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) (every push to `main`).

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
refreshes the screenshots in `docs/images/cms/`. Requires a Playwright browser:
`npx playwright install chromium`.

## One-time repository setup (owner)

1. **GitHub Pages** — *Settings → Pages → Build and deployment → Source:* **GitHub Actions**.
   The first push to `main` deploys the site.
2. **Editors** — add the manager as a **collaborator** with *Write* permission
   (*Settings → Collaborators*). Sveltia CMS only lets repository collaborators in; everyone
   else sees "You don't have access to the repository".
3. **Protect `main`** — *Settings → Branches (or Rules) → add rule for `main`*:
   require a pull request before merging, require **1 approval**, require the status check
   **"Validate & build (PR)"**, block force pushes. This is what makes the review step mandatory.
   Also enable *Settings → General → Pull Requests → Automatically delete head branches* so
   merged `cms/…` branches are cleaned up.
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

## Reviewing a content change

1. The manager saves in the editor → a pull request titled e.g.
   `content: update Site Content “menu”` appears from branch `cms/site/menu`, labelled
   `sveltia-cms/pending_review` once they click **Send for Review**.
2. The **PR check** validates the content and builds the site. Open *Files changed* to see the
   exact text diff.
3. **Approve** and **Squash and merge**. The *Deploy to GitHub Pages* workflow publishes the
   change within a couple of minutes.

## Project layout

```
admin/index.html            entry of the hidden editor (→ dist/admin/)
content/                    CMS-managed content (JSON + Markdown)
docs/                       design document, manager guide, screenshots
public/admin/logo.svg       editor logo / favicon
scripts/validate-content.ts CI content validator (rules come from src/admin/config.ts)
src/admin/                  Sveltia CMS bootstrap, typed config, site-themed skin
src/components/             React UI (Markdown.tsx renders blog bodies safely)
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
