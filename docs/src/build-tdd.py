from docx import Document
from docx.shared import Pt, Cm, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_ORIENT, WD_SECTION
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import datetime, os

import pathlib
ROOT = str(pathlib.Path(__file__).resolve().parents[2])
IMG = f"{ROOT}/docs/images"
doc = Document()

# ------------------------------------------------------------------ styles
styles = doc.styles
base = styles["Normal"]; base.font.name = "Calibri"; base.font.size = Pt(10.5)
base.element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
for lvl, size, color in [(1, 18, "8C3D1E"), (2, 14, "24211E"), (3, 12, "24211E")]:
    st = styles[f"Heading {lvl}"]; st.font.name = "Georgia"; st.font.size = Pt(size); st.font.bold = True
    st.font.color.rgb = RGBColor.from_string(color)
    st.element.rPr.rFonts.set(qn("w:eastAsia"), "Georgia")
styles["Title"].font.name = "Georgia"; styles["Title"].font.size = Pt(30); styles["Title"].font.color.rgb = RGBColor.from_string("24211E")

sec = doc.sections[0]
sec.page_width = Cm(21.0); sec.page_height = Cm(29.7)
sec.left_margin = sec.right_margin = Cm(2.2); sec.top_margin = sec.bottom_margin = Cm(2.0)

def shade(cell, hex_fill):
    tcPr = cell._tc.get_or_add_tcPr(); shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear"); shd.set(qn("w:color"), "auto"); shd.set(qn("w:fill"), hex_fill); tcPr.append(shd)

def H(text, lvl=1): return doc.add_heading(text, level=lvl)
def P(text="", bold=False, italic=False, size=None, style=None, align=None):
    p = doc.add_paragraph(style=style) if style else doc.add_paragraph()
    if text:
        r = p.add_run(text); r.bold = bold; r.italic = italic
        if size: r.font.size = Pt(size)
    if align: p.alignment = align
    return p
def RICH(parts, style=None):
    """parts: list of (text, fmt) where fmt in '', 'b', 'i', 'c' (code)."""
    p = doc.add_paragraph(style=style) if style else doc.add_paragraph()
    for text, fmt in parts:
        r = p.add_run(text)
        if "b" in fmt: r.bold = True
        if "i" in fmt: r.italic = True
        if "c" in fmt: r.font.name = "Consolas"; r.font.size = Pt(9.5); r.element.rPr.rFonts.set(qn("w:eastAsia"), "Consolas")
    return p
def B(text, lvl=0):
    p = doc.add_paragraph(style="List Bullet" if lvl == 0 else "List Bullet 2")
    _inline(p, text); return p
def N(text):
    p = doc.add_paragraph(style="List Number"); _inline(p, text); return p
def _inline(p, text):
    """Very small inline markup: `code` and **bold**."""
    import re
    for tok in re.split(r"(`[^`]+`|\*\*[^*]+\*\*)", text):
        if not tok: continue
        if tok.startswith("`"):
            r = p.add_run(tok[1:-1]); r.font.name = "Consolas"; r.font.size = Pt(9.5); r.element.rPr.rFonts.set(qn("w:eastAsia"), "Consolas")
        elif tok.startswith("**"):
            r = p.add_run(tok[2:-2]); r.bold = True
        else:
            p.add_run(tok)
def CODE(text):
    p = doc.add_paragraph(); p.paragraph_format.left_indent = Cm(0.5)
    r = p.add_run(text); r.font.name = "Consolas"; r.font.size = Pt(8.5); r.element.rPr.rFonts.set(qn("w:eastAsia"), "Consolas")
    pPr = p._p.get_or_add_pPr(); shd = OxmlElement("w:shd"); shd.set(qn("w:val"), "clear"); shd.set(qn("w:fill"), "F5EDE3"); pPr.append(shd)
    return p
def TABLE(headers, rows, widths=None, font=9):
    t = doc.add_table(rows=1, cols=len(headers)); t.style = "Table Grid"; t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(headers):
        c = t.rows[0].cells[i]; c.text = ""; r = c.paragraphs[0].add_run(h); r.bold = True; r.font.size = Pt(font); shade(c, "F0E7DC")
    for row in rows:
        cells = t.add_row().cells
        for i, val in enumerate(row):
            cells[i].text = ""; p = cells[i].paragraphs[0]; _inline(p, str(val))
            for r in p.runs: r.font.size = Pt(font)
    if widths:
        for row in t.rows:
            for i, w in enumerate(widths): row.cells[i].width = Cm(w)
    doc.add_paragraph(); return t
def landscape_figure(path, caption, width=24.5):
    """Put a wide diagram on its own landscape page, then return to portrait."""
    s = doc.add_section(WD_SECTION.NEW_PAGE)
    s.orientation = WD_ORIENT.LANDSCAPE; s.page_width, s.page_height = Cm(29.7), Cm(21.0)
    s.left_margin = s.right_margin = Cm(2.0); s.top_margin = s.bottom_margin = Cm(1.8)
    FIG(path, caption, width)
    s2 = doc.add_section(WD_SECTION.NEW_PAGE)
    s2.orientation = WD_ORIENT.PORTRAIT; s2.page_width, s2.page_height = Cm(21.0), Cm(29.7)
    s2.left_margin = s2.right_margin = Cm(2.2); s2.top_margin = s2.bottom_margin = Cm(2.0)

def FIG(path, caption, width=16.5):
    doc.add_picture(path, width=Cm(width)); doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    p = P(caption, italic=True, size=9, align=WD_ALIGN_PARAGRAPH.CENTER); p.paragraph_format.space_after = Pt(10)

# ================================================================== COVER
p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(120)
r = p.add_run("Slow Dough Pizza Co. website"); r.font.name = "Georgia"; r.font.size = Pt(14); r.font.color.rgb = RGBColor.from_string("8C3D1E")
t = doc.add_paragraph(); r = t.add_run("Sveltia CMS integration\nTechnical Design Document"); r.font.name = "Georgia"; r.font.size = Pt(28); r.bold = True; r.font.color.rgb = RGBColor.from_string("24211E")
P("Self-service content editing (Daily Menu, Blog, Dough announcement, Opening hours) with pull-request review and automated deployment to GitHub Pages.", italic=True, size=11)
doc.add_paragraph()
TABLE(["Item", "Value"], [
    ["Repository", "https://github.com/smagara/SlowDoughPizzaSite_Sveltia"],
    ["Live site", "https://smagara.github.io/SlowDoughPizzaSite_Sveltia/"],
    ["Content editor", "https://smagara.github.io/SlowDoughPizzaSite_Sveltia/admin/ — unlisted URL, not linked from the site (v1.2)"],
    ["Document version", "1.2 — " + datetime.date.today().strftime("%d %B %Y") + " (see §16 Revision history)"],
    ["Status", "Prototype — implemented and verified offline with an end-to-end test; production sign-in (OAuth helper) and branch protection require one-time owner setup (§12)"],
    ["Audience", "Site owner, developers maintaining the site, reviewers of content pull requests"],
    ["Companion document", "Manager Quick Guide (docs/Manager-Quick-Guide.pdf) — 2-page instructions for the pizza manager"],
], widths=[4, 12.5])
doc.add_page_break()

# ================================================================== TOC placeholder
H("Contents")
P("1. Introduction · 2. Requirements and traceability · 3. Solution overview · 4. Content model · 5. The editor (Sveltia CMS) · 6. Authentication and authorisation · 7. Editorial workflow: from Save to pull request · 8. Build and deployment (CI/CD) · 9. Input validation and security · 10. Local edit mode for development · 11. Testing strategy · 12. Setup and operations runbook · 13. Design decisions log · 14. Open questions · 15. Risks and mitigations · 16. Revision history · Appendix A: File inventory · Appendix B: Editor screenshots", size=10)
doc.add_page_break()

# ================================================================== 1
H("1. Introduction")
H("1.1 Purpose", 2)
P("This document describes the design of the content-management capability added to the Slow Dough Pizza Co. marketing website. It explains what was built, why each design choice was made, which alternatives were considered, how the solution is operated, and which questions remain open. It is written so that a developer who has never seen the repository can maintain it, and so that the site owner can understand the security and review model.")
H("1.2 Scope", 2)
P("In scope:")
for s in [
    "Integration of Sveltia CMS as a hidden, browser-based editor for the existing React/Vite/Tailwind site.",
    "Migration of the editable content (Daily Menu, Blog posts, Dough announcement, Opening hours) from TypeScript source into data files the editor can write.",
    "Two operating modes: a local edit mode for development/testing and a production mode backed by GitHub.",
    "Access restricted to GitHub collaborators of the repository.",
    "Validation of free-text input (including script/HTML characters) in the editor, in CI and at render time.",
    "A pull-request based publishing workflow on a feature branch, with review/approval on GitHub.",
    "Automatic build and deployment to GitHub Pages when a pull request is merged to main.",
]: B(s)
P("Out of scope: image/media management (no image fields are exposed yet), multilingual content, deploy previews per pull request, and analytics. These are listed in §14 where relevant.")
H("1.3 Starting point", 2)
P("The original repository is a single-page React 19 application built with Vite 8 and Tailwind CSS 4. All text content lived in src/data/pizzaShopData.ts as TypeScript constants, which a non-technical user cannot safely edit. There was no CI/CD configuration and no deployment target.")

# ================================================================== 2
H("2. Requirements and traceability")
P("The table maps each requirement from the brief to the design element that satisfies it and to the evidence that it works.")
TABLE(["#", "Requirement (from the brief)", "Design element", "Verified by"], [
    ["R1", "Integrate Sveltia CMS so the owner can self-service the Daily Menu, Blog posts and Dough announcement", "§4 content model (content/*.json, content/blog/*.md); §5 editor collections `site` and `blog`", "e2e scenarios 3, 5, 6; screenshots B-3…B-9"],
    ["R2", "Local edit mode for dev testing", "§10 — Sveltia's “Work with Local Repository” on localhost (File System Access API), no proxy server", "e2e scenario 7 (fake file system)"],
    ["R3", "Production integration with GitHub, running on GitHub Pages from the named repository", "§6, §8 — GitHub backend `smagara/SlowDoughPizzaSite_Sveltia`, Pages deployment with base path", "e2e scenario 8 (production build served at the Pages URL)"],
    ["R4", "Hidden link to a web form of the editable fields, styled appropriately for the site", "§5.4 — v1.0 used an unobtrusive ✎ footer link; per the owner's v1.2 request the site now contains no link at all and editors use the unlisted /admin/ URL. Editor skinned in the site palette; preview pane renders the real page sections (§5.5)", "e2e scenarios 1, 3, 6, 8 (no link/reference to /admin in the public page; preview templates rendered); screenshots B-1, B-5…B-12"],
    ["R5", "Only GitHub repository collaborators may access", "§6 — Sveltia checks `/repos/{owner}/{repo}/collaborators/{user}`; GitHub enforces write permission on every API call", "e2e scenario 2 (non-collaborator rejected)"],
    ["R6", "Reasonable validation of free text, incl. script characters", "§9 — five layers: form rules (regex/length/options), PR review, CI validator, safe rendering, CSP", "e2e scenario 4; `npm run validate:content` negative test"],
    ["R7", "A successful update triggers a pull request on a feature branch (not main) for review/approval", "§7 — Editorial Workflow: branch `cms/<collection>/<slug>`, draft PR, “Send for Review”; editors cannot publish (`publish: false`)", "e2e scenarios 3, 5, 6 (branch, commit, PR, labels asserted)"],
    ["R8", "Approval + merge to main automatically builds and deploys", "§8 — `.github/workflows/deploy.yml` on push to main → validate → build → deploy-pages", "Workflow file review; build verified locally (same commands)"],
    ["R9", "Technical design document with flow diagram; manager PDF with screenshots", "This document (§7 flow diagram) and docs/Manager-Quick-Guide.pdf", "—"],
], widths=[0.9, 5.2, 6.2, 4.2], font=8.5)

# ================================================================== 3
H("3. Solution overview")
P("Figure 1 (next page) shows the overall architecture. The site remains a fully static build. Editable content is stored as plain files in the repository; the React components import those files at build time. Sveltia CMS — a single-page application that runs entirely in the editor's browser — reads and writes the same files through the GitHub API on a dedicated branch and opens a pull request. GitHub Actions validates and builds every pull request and deploys main to GitHub Pages after a merge. No server-side code is required anywhere in the path; the only optional service is a tiny OAuth helper for the “Sign in with GitHub” button.")
landscape_figure(f"{IMG}/diagrams/architecture.png", "Figure 1 — System architecture: repository, build pipeline, runtime and local development mode.")
H("3.1 Technology summary", 2)
TABLE(["Concern", "Choice", "Notes"], [
    ["Site framework", "React 19, Vite 8, Tailwind CSS 4 (unchanged)", "Existing stack kept; content layer and admin entry added"],
    ["CMS", "Sveltia CMS 0.221 (`@sveltia/cms`, bundled by Vite)", "Git-based, serverless, Editorial Workflow support with GitHub"],
    ["Content storage", "JSON (menu, announcement, hours) + Markdown with YAML front matter (blog)", "Human-readable diffs in pull requests"],
    ["Markdown rendering", "react-markdown 10 with element whitelist, raw HTML skipped", "No innerHTML; URLs sanitised"],
    ["Hosting", "GitHub Pages (project site, base path /SlowDoughPizzaSite_Sveltia/)", "Deployed by GitHub Actions (actions/deploy-pages)"],
    ["Authentication", "GitHub OAuth via Sveltia CMS Authenticator (Cloudflare Worker) or GitHub personal access token", "Token mode works with zero infrastructure"],
    ["CI", "GitHub Actions: PR check (validate, type-check, build) and deploy workflow", "Content validator re-uses the CMS field rules"],
    ["Testing", "Playwright (Chromium) with an in-process simulated GitHub API", "Runs offline; also generates documentation screenshots"],
], widths=[3.2, 6.3, 7])

# ================================================================== 4
H("4. Content model")
P("All editor-managed content lives under content/. These are the only files the manager ever changes. Everything else (layout, copy that is not expected to change, styling) stays in source code under the developer's control.")
TABLE(["File", "Format", "Editor entry", "Used by"], [
    ["content/menu.json", "JSON — `intro`, `categories[]` → `items[]`", "Site Content → Daily Menu", "MenuSection.tsx"],
    ["content/announcement.json", "JSON — `enabled`, `headline`, `detail`", "Site Content → Dough Announcement", "Navbar.tsx (top banner)"],
    ["content/hours.json", "JSON — `days[7]` (day, hours, statusNote, isClosed)", "Site Content → Opening Hours", "HoursAndLocation.tsx"],
    ["content/blog/<slug>.md", "Markdown body + YAML front matter (title, subtitle, author, authorRole, date, artType, excerpt, keyTakeaways[], visible)", "Blog Posts (one entry per file)", "ArticlesSection.tsx via Markdown.tsx"],
], widths=[4.2, 6.3, 3.5, 2.5])
H("4.1 Loader and derived fields", 2)
P("src/content/index.ts is the single import point. It gives every consumer a typed object (src/types.ts) and derives what the editor should not have to maintain:")
for s in [
    "Stable `id`s for menu categories and items are generated from their names (slugified, de-duplicated) — used for React keys and DOM ids. Editors never see or type ids.",
    "Blog posts are sorted newest-first by `date`; posts with `visible: false` are excluded; `readTime` is computed from the word count; `publishedDate` is formatted for display from the ISO date.",
    "Booleans and optional strings are normalised so components can rely on their presence.",
]: B(s)
H("4.2 Markdown import at build time", 2)
P("A small Vite plugin (tools/vite-plugin-markdown-content.ts) turns each content/blog/*.md file into a JSON module {frontmatter, body, file} during the build. Front matter is parsed with the yaml package in Node, so no YAML parser ships to the browser. The Markdown body is rendered at runtime by the Markdown component (§9.4). Adding a blog post therefore never requires a code change — import.meta.glob picks up new files automatically.")
H("4.3 Why JSON for structured data and Markdown for posts", 2)
P("JSON is imported natively by Vite with no tooling, parses strictly (a malformed file fails the build instead of silently rendering wrong), and Sveltia writes it deterministically (2-space indentation configured in `output.json`) so pull-request diffs show only the lines that changed. Markdown with YAML front matter is the idiomatic Sveltia format for posts: it gives the manager a rich-text editor for the body while keeping metadata as structured fields, and a reviewer can read the whole post in the pull request.")

# ================================================================== 5
H("5. The editor (Sveltia CMS)")
H("5.1 Why Sveltia CMS", 2)
P("Sveltia CMS is a modern, actively maintained successor to Netlify/Decap CMS. It was chosen (and required by the brief) because it is framework-agnostic, runs entirely in the browser against the Git provider's API, supports GitHub Editorial Workflow (branch + pull request per change), and offers a local-repository mode without running a proxy server. Version 0.221.1 from npm is used.")
H("5.2 Bundled, typed configuration", 2)
P("Two less common choices were made deliberately:")
B("**Bundled, not CDN.** The editor page (admin/index.html → src/admin/main.ts) imports @sveltia/cms from npm and is built by Vite together with the site. The version is pinned in package.json, builds are reproducible, and the editor works offline (which made the end-to-end test possible). The alternative, loading the latest build from unpkg, gets automatic updates but also unreviewed changes in production.")
B("**TypeScript configuration instead of admin/config.yml.** src/admin/config.ts exports a `CmsConfig` object passed to `CMS.init({ config })` with `load_config_file: false`. It is type-checked by `npm run lint` against Sveltia's own type definitions (a typo in an option is a build error, not a runtime surprise), it can derive paths from Vite's BASE_URL (the site lives under a sub-path on GitHub Pages), shared validation rules are declared once, and the CI validator imports the same file (§9.2).")
H("5.3 Collections and fields", 2)
TABLE(["Collection / file", "Key fields and rules"], [
    ["Blog Posts (folder collection `blog`)", "title (3–120 chars, no < >), subtitle, author, authorRole, date (YYYY-MM-DD, default today), artType (select: dough | oven), excerpt (20–300 chars), keyTakeaways (list of ≤5 strings), visible (boolean), body (Markdown; toolbar limited to bold, italic, H2, H3, quote, lists, link; no images/code/HTML; rejects HTML tags). Slug from title, editable on creation, pattern ^[a-z0-9]+(-[a-z0-9]+)*$."],
    ["Site Content → Daily Menu", "intro (≤400 chars); categories (1–8, reorderable) each with title (≤80), subtitle (≤200), items (1–30, reorderable) with name (2–80), italianName, description (≤300), price (number 0–500, step 0.5), tags (multi-select from a fixed badge vocabulary)."],
    ["Site Content → Dough Announcement", "enabled (boolean), headline (3–80 chars), detail (≤80 chars)."],
    ["Site Content → Opening Hours", "days: exactly 7 rows; day is read-only; hours (≤40), statusNote (≤80), isClosed (boolean). Adding/removing/reordering days is disabled."],
], widths=[4.5, 12])
P("Every free-text field carries a `pattern` rule (§9.1) and a `maxlength`; list fields have `min`/`max`; selects use fixed option lists so a value can only be one of the known badges or illustrations.")
H("5.4 Entry point: an unlisted URL, no link on the site", 2)
P("Version 1.0 placed a faint ✎ icon in the footer (visible on hover/focus) that linked to /admin/. After review the owner asked for the editor to stay secret from visitors and bots, so since v1.2 the public site contains no link and no reference to the editor at all — the end-to-end test asserts that neither the rendered page nor dist/index.html mentions “admin”. Editors reach the editor through the address https://smagara.github.io/SlowDoughPizzaSite_Sveltia/admin/, which they bookmark; the manager guide gives the address on its first page.")
P("What this does and does not achieve: the page is not discoverable (no inbound link; <meta name=\"robots\" content=\"noindex, nofollow\">; no sitemap entry), but it is still a public URL. Anyone who guesses it sees only the sign-in page; every action behind it requires GitHub sign-in and repository collaborator access (§6). Deliberately no robots.txt Disallow line is added, because that file is public and would advertise the path. Obscurity lowers noise; GitHub provides the security.")
H("5.5 Site styling and the live preview", 2)
P("The editor is skinned to match the site (src/admin/theme.css): Sveltia's UI is driven by CSS custom properties, so the accent colour is set to the site's terracotta (#c85a32), backgrounds to the site's cream palette, headings to Georgia and body text to the system sans-serif stack. The login page shows the site name and a custom logo (public/admin/logo.svg; since v1.2 a light tile with a terracotta ring so it renders correctly on the dark theme as well).")
P("The preview pane renders the section being edited as it will look on the website (src/admin/preview/). Four React templates are registered with CMS.registerPreviewTemplate — keyed by file name for the Site Content files (menu, announcement, hours) and by collection name for blog — together with a stylesheet injected into the preview iframe that reproduces the site's palette and typography (Tailwind is not available there). They mirror the public components: the Daily Menu with its section pills, item cards, prices and dietary badges; the dark announcement strip above the real header and hero, or a note when the banner is switched off; the Weekly Schedule table with closed days; and the blog post card (meta line, title, subtitle, excerpt, Essential Insights) followed by the full essay, whose Markdown body is rendered by Sveltia's own sanitised preview widget inside the site's article styling. A thin browser-like frame labels each preview “as it will appear on slowdoughpizza.com”. The templates are pure, hook-free function components, so the JSX produced by this project's React runtime can be rendered by the React instance bundled inside Sveltia (same major version); they update live as fields change and show placeholders for empty fields. The preview always uses the light site palette, independent of the editor theme, because it depicts the website rather than the editor.")
H("5.6 No media uploads", 2)
P("The site has no image fields (all artwork is inline SVG), so an Assets area would only invite stray uploads. Sveltia insists on a media_folder in its configuration validation, therefore two measures are combined: the asset entry points — the Assets navigation item, the “Show Assets” toolbar button and the “Assets” item of the global “+” menu — are removed from the UI by theme.css, and the default media library is configured with max_file_size: 0 so that any upload, including one attempted through the direct #/assets route, is rejected before anything is committed. The end-to-end test covers both. If photos are wanted later (§14), revert these two settings and add an Image field.")
FIG(f"{IMG}/cms/05-menu-editor.png", "Figure 2 — The Daily Menu editor: fields on the left, the site-styled live preview on the right.", 15.5)

# ================================================================== 6
H("6. Authentication and authorisation")
H("6.1 Sign-in options", 2)
P("GitHub Pages is static, so an OAuth flow needs a small external helper to exchange the authorisation code for a token (the client secret must not live in the browser). Two sign-in methods are configured:")
B("**Sign in with GitHub (OAuth)** — recommended. Uses the official Sveltia CMS Authenticator deployed as a Cloudflare Worker (free tier), referenced by `backend.base_url`. The URL is injected at build time from the repository variable CMS_OAUTH_BASE_URL. If the variable is unset the button is not shown at all, so the site never ships a broken sign-in.")
B("**Sign in using access token** — zero infrastructure fallback. The manager creates a fine-grained personal access token scoped to this single repository with Contents: read/write and Pull requests: read/write (the dialog links to a pre-filled GitHub form) and pastes it once; Sveltia stores it in the browser's local storage.")
H("6.2 Authorisation: collaborators only", 2)
P("After sign-in Sveltia loads the user profile, detects the repository's default branch (GraphQL defaultBranchRef) and calls GET /repos/smagara/SlowDoughPizzaSite_Sveltia/collaborators/{login}. Anyone who is not a collaborator is stopped with “You don't have access to the repository” before any content is loaded (verified in e2e scenario 2). This check is a convenience; the real enforcement is GitHub itself: every branch creation, commit and pull-request call is made with the user's own token and is rejected by GitHub unless that account has write permission on the repository. There is no shared service account and no way to act as somebody else.")
H("6.3 What a collaborator can and cannot do", 2)
B("Can: read all files in the repository (it is public anyway), create and update branches named cms/…, open pull requests, change their labels and mark them ready for review.")
B("Cannot from the editor: merge to main. The Publish control is disabled for every collection (`publish: false`), and branch protection on main (§12) requires a pull request with an approval and a green status check even for users with write access. Open Authoring (editing from forks) is off, so outsiders cannot even propose changes through the editor.")

# ================================================================== 7
H("7. Editorial workflow: from Save to pull request")
P("Sveltia's Editorial Workflow (`publish_mode: editorial_workflow`) is enabled globally. Figure 3 (next page) shows the full path of a change from the manager's browser to the live site; the numbered steps are described in the table below.")
landscape_figure(f"{IMG}/diagrams/content-update-flow.png", "Figure 3 — Content update flow across the manager, GitHub, GitHub Actions and the reviewer (numbered steps are described in the table that follows).")
TABLE(["Step", "What happens", "Where"], [
    ["1–2", "Manager opens the bookmarked editor URL and signs in; Sveltia verifies collaborator status.", "Browser → GitHub API"],
    ["3–4", "Manager edits fields; the form validates required fields, lengths, option lists and the anti-markup regex rules. Save is blocked until errors are fixed.", "Browser"],
    ["5–6", "On Save, Sveltia creates (or reuses) branch cms/<collection>/<slug> from the head of main, commits the changed file(s) with the message `content: update <collection> “<slug>”` via the GraphQL createCommitOnBranch mutation, and opens a DRAFT pull request against main labelled sveltia-cms/draft. main is never written to.", "GitHub"],
    ["7–8", "Because editors cannot publish, Sveltia immediately asks “Send for Review”. Confirming replaces the label with sveltia-cms/pending_review and marks the pull request ready for review (no longer a draft). “Later” keeps it as a draft the manager can keep editing.", "Browser → GitHub"],
    ["9", "The PR check workflow runs: content validation, type-check and a full build. Its result appears as a status check on the pull request.", "GitHub Actions"],
    ["10–11", "The reviewer reads the diff (plain JSON / Markdown), approves and merges (squash merge recommended). Branch protection makes approval + green check mandatory.", "Reviewer on GitHub"],
    ["12–13", "The push to main triggers the deploy workflow: validate → build with the Pages base path → publish. The site is typically live 2–3 minutes after the merge.", "GitHub Actions → Pages"],
], widths=[1.3, 12, 3.2], font=9)
H("7.1 Conventions", 2)
TABLE(["Item", "Value"], [
    ["Base branch", "The repository's default branch, detected by Sveltia at sign-in (`backend.branch` is intentionally not set — see D15). It must be `main`, which is what the workflows build and deploy."],
    ["Branch name", "cms/<collection>/<slug>, e.g. cms/site/menu, cms/blog/harvest-special-pumpkin-sage. One branch (and one PR) per entry; further saves of the same entry add commits to the same branch."],
    ["PR title / commit message", "content: add|update|remove <Collection label> “<slug>” (configured in `backend.commit_messages`)"],
    ["PR body", "“Automatically generated by Sveltia CMS”"],
    ["Labels", "sveltia-cms/draft → sveltia-cms/pending_review (→ sveltia-cms/pending_publish is unused because publishing from the editor is disabled)"],
    ["Draft state", "Draft PR while the status is Draft; ready for review after “Send for Review”"],
    ["Merge", "Done by the reviewer on GitHub. `squash_merges: true` only affects the (disabled) in-editor publish action; enable “Automatically delete head branches” in the repository so merged cms/… branches disappear."],
    ["Deleting an entry", "Deleting a blog post in the editor also goes through a pull request (label sveltia-cms/pending_deletion); nothing is removed from main without review."],
    ["Discarding", "The manager can discard an unpublished change from the Editorial Workflow board; Sveltia closes the PR and deletes the branch."],
], widths=[3.8, 12.7], font=9)
H("7.2 What the reviewer sees", 2)
P("The pull request's Files changed tab shows a line-level diff of a JSON or Markdown file (e.g. `\"price\": 19` → `\"price\": 21`). The PR check summary lists the changed files. Because the validator and the build run on the exact merge result, a green check means the site will build with that content. If the check is red, the job log names the file, field and rule that failed (e.g. “content/menu.json: categories[0].items[2].description is longer than 300 characters”).")

# ================================================================== 8
H("8. Build and deployment (CI/CD)")
TABLE(["Workflow", "Trigger", "Steps", "Purpose"], [
    [".github/workflows/pr-check.yml — “Validate & build (PR)”", "pull_request → main", "checkout · setup-node 22 · npm ci · `npm run validate:content` · `npm run lint` · `npm run build` (BASE_PATH set) · summary of changed files", "Status check for every pull request, including those opened by the editor. Intended as a required check in branch protection."],
    [".github/workflows/deploy.yml — “Deploy to GitHub Pages”", "push → main, manual dispatch", "same validate/lint/build · upload-pages-artifact · deploy-pages (environment github-pages)", "Publishes the site after a merge. concurrency group `pages` cancels superseded runs; permissions limited to pages:write + id-token:write."],
], widths=[4.2, 2.6, 5.7, 4], font=8.5)
H("8.1 Base path", 2)
P("A GitHub project site is served from https://smagara.github.io/SlowDoughPizzaSite_Sveltia/. Vite's `base` is therefore taken from the BASE_PATH environment variable (set to `/${repository name}/` by the workflows; `/` locally). Everything that needs an absolute path — the editor logo, `public_folder`, `logout_redirect_url` — is derived from import.meta.env.BASE_URL so the same source works locally and in production. The build emits two HTML entry points: dist/index.html (public site) and dist/admin/index.html (editor).")
H("8.2 Build-time inputs", 2)
B("BASE_PATH — Pages sub-path (workflows only).")
B("VITE_CMS_OAUTH_BASE_URL — from the repository variable CMS_OAUTH_BASE_URL; optional (§6.1).")
H("8.3 Build output notes", 2)
P("Two messages can appear in the build log; neither indicates a problem, and both were reviewed during the first deployment:")
B("**“Some chunks are larger than 500 kB after minification”** — the editor entry (dist/assets/admin-*.js, ≈2.1 MB minified / 650 kB gzipped) bundles Sveltia CMS, a pre-built single-page application whose optional features (syntax highlighting languages, image codecs, maps, locales) are already emitted as lazily loaded chunks. It cannot be split further from this project. `build.chunkSizeWarningLimit` is set to 2 600 kB in vite.config.ts so the warning stays meaningful for the public site, whose chunk is ≈400 kB. The public page never loads the editor bundle.")
B("**“[PLUGIN_TIMINGS] JavaScript callbacks ran for …”** — an informational diagnostic of Rolldown, the bundler inside Vite 8, reporting how much build time was spent inside JavaScript plugin hooks (on the reporting machine 1.5 s of 9.5 s). The project's two plugins now declare hook filters (the Markdown plugin only runs for content/**/*.md, the CSP plugin only for the public index.html), so they add no per-module overhead; the remaining time is the React and Tailwind plugins, which is normal. The note about “callbacks listed without a time … overlapped” is part of the same diagnostic. It can be profiled with `node --cpu-prof` if it ever grows.")
P("The previous “Your Vite config uses features that are unsupported by configLoader: 'native'” notice was removed by using import.meta.dirname and explicit .ts extensions in vite.config.ts.")
H("8.4 Timing and failure behaviour", 2)
P("A typical deploy completes in 2–3 minutes. If validation or the build fails on main (which should be impossible once the PR check is required), nothing is deployed and the previous version stays live. Re-running the workflow manually (workflow_dispatch) is supported.")

# ================================================================== 9
H("9. Input validation and security")
P("Free text written by a non-technical editor is the main attack surface of a content-managed site. The design applies five independent layers; any single layer failing still leaves the site safe.")
FIG(f"{IMG}/diagrams/validation-layers.png", "Figure 4 — Validation and rendering layers between the editor's keyboard and the visitor's page.", 17)
H("9.1 Layer 1 — editor form rules", 2)
TABLE(["Rule", "Applies to", "Effect"], [
    ["SAFE_TEXT: `^[^<>]*$`", "Every single-line and plain-text field (titles, names, descriptions, notes, excerpts, list items)", "Rejects any angle bracket with the message “Angle brackets < and > are not allowed — please use plain text.”"],
    ["SAFE_MARKDOWN: `^(?:[^<]|<(?![a-zA-Z/!?]))*$`", "Blog body (Markdown)", "Rejects anything that looks like an HTML tag (<script, </div, <!--, <?xml) while still allowing “>” for block quotes and a bare “<” in prose (“< 40 °F”)."],
    ["maxlength / minlength", "All text fields", "Prevents oversized payloads and layout-breaking strings; the counter is shown under the field."],
    ["Fixed option lists", "Menu badges, illustration type", "The value can only be one of the known options."],
    ["Number range", "Price (0–500, step 0.5)", "No negative or absurd prices; stored as a number, not a string."],
    ["List size / structure", "Menu sections 1–8, items 1–30, takeaways ≤5, hours exactly 7 (no add/remove)", "Keeps the page layout within its designed bounds."],
    ["Slug pattern", "Blog file names", "Lowercase letters, digits and dashes only — safe file names and URLs."],
    ["Limited rich-text toolbar", "Blog body", "No image, code or raw-HTML components; editors can't paste arbitrary markup as a component."],
], widths=[4.6, 4.6, 7.3], font=8.5)
P("Validation happens on Save; Sveltia shows the error under each field and a banner “N fields have errors”, and nothing is sent to GitHub (verified in e2e scenario 4).")
H("9.2 Layer 3 — CI validator (server-side re-validation)", 2)
P("Browser-side validation can be bypassed by a determined user with write access (e.g. by committing a file by hand). scripts/validate-content.ts therefore walks the collections defined in src/admin/config.ts and re-applies the same rules to every file in content/: required fields, lengths, regex patterns, option lists, list sizes, number ranges, date format, unknown keys, file-name slugs and YAML front-matter syntax. In addition it scans every string for HTML tags, javascript: URLs, inline event handlers (on…=) and data:text/html URLs. It runs in the PR check and before every deploy, and fails the job with a precise message. Because the rules are read from the configuration there is one source of truth — adding a field to the editor automatically adds it to the validator.")
H("9.3 Layer 2 — human review", 2)
P("Every change is a pull request whose diff is small and readable. This is the only layer that can judge tone, typos and prices; the technical layers make sure the reviewer never has to look for hidden markup.")
H("9.4 Layer 4 — safe rendering", 2)
B("React escapes every string it renders; no component uses dangerouslySetInnerHTML.")
B("Blog bodies are rendered by src/components/Markdown.tsx (react-markdown). Raw HTML inside Markdown is dropped (`skipHtml`); only p, h2, h3, blockquote, strong, em, ul, ol, li, a and br are rendered (`allowedElements` + `unwrapDisallowed`); link URLs pass through react-markdown's default transform, which neutralises javascript: and other unsafe protocols; external links get rel=\"noopener noreferrer\".")
B("JSON values are used as text, numbers or booleans only — never interpreted.")
H("9.5 Layer 5 — Content Security Policy", 2)
P("GitHub Pages cannot send HTTP headers, so tools/vite-plugin-csp.ts injects a <meta http-equiv=\"Content-Security-Policy\"> tag into the public page at build time: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'`. Even if markup slipped through every other layer, the browser would refuse to run inline scripts. The policy is build-only (the dev server needs inline scripts for hot reloading) and is not applied to the editor page, which must call api.github.com, the OAuth helper and use workers/wasm. The e2e test asserts that the production page loads with zero CSP violations.")
H("9.6 Other security notes", 2)
B("No secrets in the repository or the browser bundle: the OAuth client secret lives only in the Cloudflare Worker; the user's token is issued to the user.")
B("The editor page is marked noindex and lives outside the site's navigation; it is still a public URL (as is the repository), which is acceptable because it does nothing without GitHub credentials.")
B("GitHub Actions permissions are minimal (contents: read; pages/id-token only in the deploy job). Actions are referenced by major version tags.")
B("Dependencies are pinned through package-lock.json; Sveltia is upgraded deliberately via npm.")

# ================================================================== 10
H("10. Local edit mode for development")
FIG(f"{IMG}/diagrams/local-dev-mode.png", "Figure 5 — Local edit mode: the editor writes straight into the working copy; no GitHub calls are made.", 16)
P("When the editor is opened on localhost (e.g. http://localhost:3000/admin/ with `npm run dev`), Sveltia automatically adds a “Work with Local Repository” button. The developer picks the repository folder in the browser's directory picker (File System Access API — Chrome and Edge; Firefox and Safari do not support it) and Sveltia reads and writes content/ files directly. The Vite dev server notices the change and hot-reloads the site, so a developer can test field definitions, validation messages and the resulting page in seconds. Edits are ordinary uncommitted changes reviewed with `git diff` and committed (or discarded) by the developer; there is no branch/PR in this mode and the Editorial Workflow UI is not shown. No configuration switch is needed: the same config.ts serves both modes, which avoids drift between what is tested locally and what runs in production. For the same reason the `local_backend` option known from Decap CMS and its proxy server are not used (Sveltia ignores it).")
P("The GitHub mode can also be exercised locally: on localhost the login page additionally shows “Sign in with GitHub” / “Sign in using access token” and behaves exactly as in production (branches and pull requests are created in the real repository).")
P("Two behaviours observed during the first external test are worth knowing. First, Sveltia remembers a successful sign-in (token in local storage; directory handle in IndexedDB) and opens the editor directly on the next visit, so the login page — and the local-repository option on it — is not shown again until the user chooses Sign Out from the account menu. Second, the option is keyed on the hostname: it appears for localhost/127.0.0.1 only, not for the LAN address the dev server also prints.")

# ================================================================== 11
H("11. Testing strategy")
P("Because the critical behaviour (branch, commit, pull request, labels, draft state) happens against GitHub's API, it was important to verify it without depending on network access, real tokens or polluting the real repository. tests/e2e/cms-workflow.test.mjs starts the Vite dev server, launches headless Chromium through Playwright and intercepts every request to https://api.github.com, answering it from tests/e2e/github-mock.mjs — a small in-memory implementation of the GitHub REST and GraphQL endpoints Sveltia uses (user, collaborators, trees, blobs, createRef, createCommitOnBranch, pulls, labels, ready-for-review, merge). A fake File System Access API (tests/e2e/fake-file-system.js) does the same for the local mode. The real Sveltia bundle and the real production configuration are exercised; only the network is simulated.")
TABLE(["#", "Scenario", "Asserts"], [
    ["1", "Editor page loads on localhost", "Title, local + GitHub sign-in buttons, site accent colour applied"],
    ["2", "Non-collaborator signs in", "Access denied message; no content loaded"],
    ["3", "Edit menu price → Save → Send for Review", "Site-styled preview rendered (menu cards); Assets UI hidden; branch cms/site/menu from main; commit touches only content/menu.json; draft PR → main with label sveltia-cms/draft; after sending: ready for review + sveltia-cms/pending_review; main unchanged; committed JSON well-formed with numeric price; no Publish button"],
    ["4", "Script/HTML in title and body", "Both custom error messages shown; save blocked; zero API calls"],
    ["5", "Create a blog post with heading, quote, takeaways", "Branch cms/blog/<slug>; Markdown file parses with the build plugin; front matter fields correct; PR title"],
    ["6", "Edit the announcement banner", "Preview strip updates live; branch cms/site/announcement with the new headline; upload on the direct /assets route rejected (0 bytes), nothing committed"],
    ["7", "Local repository mode", "Opening hours written to the working copy; no GitHub request made"],
    ["8", "Production build served at the GitHub Pages URL", "No link or reference to /admin in the public page; editor page is noindex; base-path-correct logo; CSP present with no violations; no local-mode button off localhost; sign-in works"],
], widths=[0.8, 6, 9.7], font=8.5)
P("Run with `npm run test:e2e`. npm install brings the Playwright package but not the browser binary; run `npm run test:e2e:setup` (= `npx playwright install chromium`) once — the test prints this hint and exits if Chromium is missing. The test also writes the screenshots used in this document and in the manager guide (docs/images/cms/). Static checks: `npm run lint` type-checks the site, the Vite plugins and the CMS configuration; `npm run validate:content` validates the committed content. Both run in CI.")
P("Robustness notes from the first external run: scenario 5 originally typed the essay into the rich-text editor with simulated keystrokes. On a slower machine the editor's own “## → heading” conversion raced with the keystrokes (the non-ASCII “°” character is inserted through a different input path) and characters were lost, so the scenario failed intermittently. It now switches the field to raw Markdown mode (“Edit in Markdown” toolbar button) and sets the whole body with a single fill(), then switches back for the screenshot. All waits are on observable state (simulated API calls, file contents) rather than on transient toasts.")
P("Not covered automatically: the real OAuth round-trip (needs the deployed worker), GitHub's branch-protection behaviour, and the Actions workflows themselves (validated by review and by running the same npm scripts locally). These are listed as post-deployment checks in §12.")

# ================================================================== 12
H("12. Setup and operations runbook")
H("12.1 One-time setup (owner)", 2)
N("Make sure the repository's default branch is main and that it contains the content/ folder (Settings → General → Default branch; rename master if necessary). The editor always edits the default branch; the workflows build and deploy main. A mismatch is the one misconfiguration the editor does not report: it simply shows empty collections (§15).")
N("Push this repository to GitHub. In Settings → Pages set Build and deployment → Source to GitHub Actions. The deploy workflow publishes the site on the next push.")
N("Add the manager as a collaborator with Write permission (Settings → Collaborators). Remove the collaborator to revoke editor access.")
N("Protect main (Settings → Branches or Rules): require a pull request before merging, require 1 approval, require the status check “Validate & build (PR)”, block force pushes. Optionally require conversation resolution. Enable Settings → General → Automatically delete head branches.")
N("Choose the sign-in method. Token mode works immediately. For “Sign in with GitHub”: create a GitHub OAuth App (Homepage URL = site URL; Authorization callback URL = https://<worker>.workers.dev/callback); deploy sveltia/sveltia-cms-auth to Cloudflare Workers with GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET and ALLOWED_DOMAINS=smagara.github.io (add localhost:3000 for local testing); add the repository variable CMS_OAUTH_BASE_URL=https://<worker>.workers.dev; re-run the deploy workflow.")
N("Post-deployment checks: open the editor URL directly (it is not linked from the site), sign in as the manager, save a harmless change (e.g. the announcement), confirm the pull request appears with the PR check running, approve, merge, and confirm the site updates.")
H("12.2 Routine operations", 2)
TABLE(["Task", "How"], [
    ["Review a content change", "Open the pull request → Files changed → Approve → Squash and merge. The site redeploys automatically."],
    ["Ask for a correction", "Request changes on the PR; the manager reopens the entry in the editor (it shows “In Review”), edits and saves again — the same PR is updated."],
    ["Undo a published change", "Revert the merge commit on GitHub (Revert button on the merged PR) and merge the revert; or fix forward through the editor."],
    ["Add a new menu badge option", "Edit MENU_TAGS in src/admin/config.ts (and the badge colours in MenuSection.tsx if needed); deploy."],
    ["Add a new editable field", "Add the field to config.ts, the type in src/types.ts, the loader in src/content/index.ts and the component; the validator picks the rule up automatically."],
    ["Upgrade Sveltia CMS", "`npm update @sveltia/cms`, run `npm run check` and `npm run test:e2e`, deploy."],
    ["Manager lost their token / new manager", "Token mode: create a new fine-grained token (Contents + Pull requests read/write on this repo). OAuth mode: nothing to do beyond collaborator access."],
    ["“Work with Local Repository” no longer offered (developer machine)", "Still signed in from a previous session (login page skipped) or opened via a non-localhost address. Sign Out from the account menu, or open http://localhost:3000/admin/."],
    ["Editor shows no existing content (Blog Posts 0, empty fields) but can create items", "The branch the editor reads has no content/ folder. Check which branch holds content/ and make it the default branch (must be main for deployment). If the branch is right, clear a stale editor cache: sign out, clear site data for the editor URL, sign in again."],
], widths=[4.5, 12], font=9)

# ================================================================== 13
H("13. Design decisions log")
TABLE(["ID", "Decision", "Alternatives considered", "Rationale / consequences"], [
    ["D1", "Move editable content to files under content/ (JSON + Markdown) and import them at build time", "Keep TypeScript data; fetch JSON at runtime", "Sveltia needs plain files; build-time import keeps the site static and type-checked; a broken file fails the build rather than the live page"],
    ["D2", "One JSON file per “site content” item (menu, announcement, hours) in a file collection; one Markdown file per blog post in a folder collection", "One big site.json; blog posts as JSON", "Small, focused diffs; one PR per concern; posts get a rich-text editor and readable review"],
    ["D3", "Sveltia bundled from npm and booted with a TypeScript config (`load_config_file: false`)", "CDN script + admin/config.yml", "Pinned version, offline builds/tests, type-checked config, base-path-aware paths, rules shared with the validator (see §5.2)"],
    ["D4", "Editorial Workflow with `publish: false` on every collection", "Simple mode (commit straight to main); letting editors publish from the CMS", "Brief requires PR review; editors get a guided “Send for Review” step; merging stays a GitHub action protected by branch rules"],
    ["D5", "OAuth via Sveltia CMS Authenticator on Cloudflare Workers, with token sign-in as fallback and the OAuth button hidden until configured", "Netlify Identity/Git Gateway; self-hosted OAuth server; token only", "Officially supported, free, stateless; no broken button before setup; token mode gives a working prototype on day one"],
    ["D6", "v1.0: hidden-but-accessible footer link. v1.2: no link at all — unlisted /admin/ URL, noindex, no robots.txt entry", "Invisible link; keyboard shortcut; robots.txt Disallow", "Owner asked for the editor to be hidden from visitors and bots; an unlisted URL is the cleanest way. Security still relies on GitHub auth, not obscurity"],
    ["D7", "Brand Sveltia's UI with CSS custom properties and a logo instead of building a custom form; v1.2 adds site-styled preview templates", "Custom React form calling the GitHub API; generic field-dump preview", "Reuses Sveltia's validation, rich-text editor, workflow UI and accessibility; the preview shows staff what they are editing in the website's own look, with Sveltia's sanitised Markdown widget embedded for the essay body"],
    ["D16", "Remove media uploads: hide asset entry points via CSS and set max_file_size: 0 (v1.2)", "Drop media_folder (rejected by Sveltia's validator); declare an unconfigured cloud library (leaves broken leftovers and a page error on /assets)", "No image fields exist; both measures together remove the UI and make uploads impossible even by URL; trivially reversible when images are wanted"],
    ["D8", "Validation rules expressed once in config.ts and re-applied by a CI script; plus anti-markup regexes on every text field", "Browser-only validation; a separate JSON Schema", "Single source of truth; server-side guarantee that nothing unvalidated reaches main or the build"],
    ["D9", "react-markdown with an element whitelist and `skipHtml` for blog bodies", "Build-time Markdown → HTML + DOMPurify; custom mini-renderer", "No innerHTML anywhere; safe by construction; small runtime cost"],
    ["D10", "Build-only <meta> CSP on the public page", "No CSP (Pages can't set headers)", "Defence in depth at zero cost; excluded from the editor page and dev server where it would break functionality"],
    ["D11", "Fixed option list for menu badges; derived ids; computed read time; hours list locked to 7 rows", "Free-text tags; editor-maintained ids", "Fewer ways to break layout or styling; less for the manager to get wrong"],
    ["D12", "Opening Hours added as a fourth editable item", "Only the three items named in the brief", "Natural routine update; cheap to add; demonstrates locked-structure lists"],
    ["D13", "Offline e2e test with a simulated GitHub API and fake file system", "Manual testing only; tests against a real sandbox repository", "Deterministic, runs anywhere, proves the PR mechanics and produces documentation screenshots; real-GitHub checks listed in the runbook"],
    ["D14", "GitHub Actions with separate PR-check and deploy workflows; BASE_PATH from the repository name", "Single workflow; hard-coded base path", "Clear required check for branch protection; works if the repository is renamed/forked"],
    ["D15", "Do not set `backend.branch`; let Sveltia detect the repository's default branch (v1.1)", "Hard-code `branch: main` (v1.0)", "v1.0 hard-coded main. In the first real deployment the editor showed empty collections while saving still worked — reproduced in the simulation as “configured branch has no content/”: Sveltia reports nothing in that case. Following the default branch removes the silent mismatch; the requirement that the default branch is main (for deployment) is now a documented, visible setup step instead of a hidden assumption."],
], widths=[0.9, 4.6, 4.3, 6.7], font=8)

# ================================================================== 14
H("14. Open questions")
for q in [
    "**Who reviews?** The brief says the owner self-serves and changes need approval. If the owner is both editor and the only reviewer, GitHub cannot require an approval from someone else. Options: a second reviewer (developer), or allow the owner to bypass the rule while the manager's changes still require approval. Decision needed before enabling branch protection.",
    "**OAuth helper hosting.** Cloudflare Workers is proposed. Does the owner have (or want) a Cloudflare account, or is token sign-in acceptable for the prototype?",
    "**Preview of a pending change.** GitHub Pages has no per-PR previews. The reviewer sees a text diff (plus a green build). If a visual preview is needed, a follow-up could publish PR builds to a preview folder or another host and use Sveltia's deploy-preview link support.",
    "**Images.** No image fields are exposed (the site uses inline SVG art). If photos are wanted, decide on a media folder under public/uploads (with size/type limits) or an external media library; the validator would need an asset check.",
    "**More editable areas.** Hero copy, contact details, the “Batch Capacity” notice and the header hours badge are still hard-coded. They can be moved to content/ with the same pattern if routine updates are expected.",
    "**Menu badge vocabulary.** Badges are a fixed list (MENU_TAGS). Confirm the list, and whether the manager should be able to add new badges (free text) at the cost of looser validation.",
    "**Date of blog posts.** Posts are listed by `date`; future-dated posts are shown immediately. Should scheduling (hide until date) be added?",
    "**Token lifetime.** Fine-grained tokens expire (max 1 year). If token mode is used long-term, decide on a renewal reminder or move to OAuth.",
    "**Notifications.** Who is notified when a PR is opened? GitHub's default notifications to the reviewer may be enough; otherwise configure a CODEOWNERS file (content/ → reviewer) so review requests are automatic.",
    "**Browser support for local mode.** The local-repository mode needs Chrome/Edge. Confirm this is acceptable for the development team.",
]: B(q)

# ================================================================== 15
H("15. Risks and mitigations")
TABLE(["Risk", "Impact", "Mitigation"], [
    ["Editor reads a branch without content/ (default branch ≠ branch with content, or stale main)", "Editor shows empty collections with no error; new entries would be proposed against the wrong baseline", "Editor follows the default branch (D15); setup step 0 and troubleshooting entry; symptom reproduced and documented"],
    ["Editor bypasses browser validation (hand-edited commit)", "Unsafe or malformed content reaches a PR", "CI validator (required check) + review + safe rendering + CSP"],
    ["Sveltia CMS upgrade changes behaviour (e.g. API usage)", "Editor breaks", "Version pinned; e2e test and `npm run check` before upgrading; simulated API makes regressions visible"],
    ["GitHub API outage or rate limit", "Editor cannot load/save", "Sveltia shows GitHub status on the login page; changes are retried by the user; nothing is lost on the site"],
    ["Stale editor cache after a merge", "Manager sees old values", "Sveltia refreshes from main on load; reloading the editor fixes it; documented in the guide"],
    ["Two people edit the same file concurrently", "Second save hits a moved branch", "Sveltia detects the conflict and asks to reload/overwrite; one PR per entry keeps scope small"],
    ["Large Sveltia bundle (~17 MB of mostly lazy-loaded assets)", "Slower first load of the editor", "Assets are code-split and cached; public site is unaffected (separate entry)"],
    ["Token leakage from the manager's browser", "Unauthorised commits/PRs as the manager", "Fine-grained, single-repo, expiring token; branch protection still requires review; revoke on GitHub"],
], widths=[5, 3.8, 7.7], font=9)

# ================================================================== 16
H("16. Revision history")
TABLE(["Version", "Change", "Trigger"], [
    ["1.0", "Initial design and implementation.", "—"],
    ["1.2", "Footer link removed — editor reachable only via the unlisted /admin/ URL (§5.4, D6). Media uploads removed (§5.6, D16). Site-styled live preview templates for menu, announcement, hours and blog (§5.5). Logo redrawn for the dark theme. Documented the remembered sign-in / Sign Out behaviour and the localhost-only local option (§10, §12). E2e test extended accordingly.", "Owner feedback after the first production use: keep the editor hidden from the public and bots; no media uploads; preview should look like the website; local option “disappeared” after the first sign-in; a visual defect."],
    ["1.1", "`backend.branch` removed so the editor follows the repository's default branch (D15); runbook step 0 and troubleshooting entry added (§12, §15). Build log reviewed: chunk-size limit raised for the editor bundle, hook filters added to the project's Vite plugins, config-loader notice fixed (§8.3). End-to-end test: raw-Markdown input instead of simulated keystrokes, explicit browser-setup script and hint (§11).", "First external deployment and test run: editor showed no existing data although creating entries and the pull request worked; two build warnings; one flaky scenario; Playwright browser not installed."],
], widths=[1.6, 10, 4.9], font=9)

# ================================================================== Appendix A
doc.add_page_break()
H("Appendix A — File inventory (added or changed)")
TABLE(["Path", "Role"], [
    ["content/menu.json, announcement.json, hours.json, blog/*.md", "Editable content (the manager's files)"],
    ["src/content/index.ts", "Typed content loader (ids, sorting, derived fields)"],
    ["src/types.ts", "Content types (kept in sync with config.ts)"],
    ["src/components/Markdown.tsx", "Safe Markdown renderer for blog bodies"],
    ["src/components/Navbar.tsx, MenuSection.tsx, ArticlesSection.tsx, HoursAndLocation.tsx", "Consume content/ (the footer no longer links to the editor)"],
    ["admin/index.html, src/admin/main.ts, src/admin/config.ts, src/admin/theme.css, src/admin/preview/templates.tsx, src/admin/preview/preview.css, public/admin/logo.svg", "The editor: entry page, bootstrap, typed configuration, site theme (incl. hiding the asset UI), site-styled preview templates + stylesheet, logo"],
    ["tools/vite-plugin-markdown-content.ts", "Build-time Markdown + front matter import"],
    ["tools/vite-plugin-csp.ts", "Build-only Content Security Policy meta tag"],
    ["scripts/validate-content.ts", "CI content validator driven by config.ts"],
    [".github/workflows/pr-check.yml, deploy.yml", "PR status check; build & deploy to GitHub Pages"],
    ["tests/e2e/cms-workflow.test.mjs, github-mock.mjs, fake-file-system.js", "Offline end-to-end test, simulated GitHub API, fake File System Access API"],
    ["vite.config.ts, tsconfig.json, package.json, .env.example, README.md", "Two HTML entries, base path, scripts, dependencies, documentation"],
    ["docs/Technical-Design-Document.docx, docs/Manager-Quick-Guide.pdf, docs/images/, docs/src/", "This document, the manager guide, their images and the scripts that generate them"],
], widths=[8, 8.5], font=8.5)

# ================================================================== Appendix B
H("Appendix B — Editor screenshots")
P("All screenshots were captured by the end-to-end test against the real editor build; the GitHub API was simulated.", italic=True, size=9)
shots = [
    ("16-production-login", "B-1 — Sign-in page as deployed on GitHub Pages (site theme, logo, no local-mode button)."),
    ("03-collections", "B-2 — Collections after sign-in: Blog Posts and Site Content (no Assets area)."),
    ("04-site-content", "B-3 — Site Content: Daily Menu, Dough Announcement, Opening Hours."),
    ("05-menu-editor", "B-4 — Daily Menu editor with the site-styled preview (menu cards, prices, badges)."),
    ("06-menu-price-edited", "B-5 — Editing a menu item (price changed; the preview follows)."),
    ("07-send-for-review", "B-6 — After Save: the pull request exists as a draft; the editor offers “Send for Review”."),
    ("08-entry-in-review", "B-7 — The Daily Menu now shows “In Review”; the pull request is ready for review on GitHub."),
    ("09-workflow-board", "B-8 — Editorial Workflow board (no Publish action for editors)."),
    ("10-validation-errors", "B-9 — Script/HTML characters rejected in a title and in the essay body."),
    ("12-blog-editor", "B-10 — Blog post editor; the preview renders the post card and essay in the site's journal style."),
    ("13-announcement-editor", "B-11 — Dough announcement editor: the preview shows the strip above the real site header."),
    ("02-not-a-collaborator", "B-12 — A GitHub user who is not a collaborator is refused."),
    ("14-local-mode-hours", "B-13 — Local repository mode editing Opening Hours (day names are read-only); preview shows the Weekly Schedule table."),
]
for name, cap in shots:
    FIG(f"{IMG}/cms/{name}.png", cap, 15.5)

out = f"{ROOT}/docs/Technical-Design-Document.docx"
doc.save(out); print("saved", out, os.path.getsize(out) // 1024, "KB")
