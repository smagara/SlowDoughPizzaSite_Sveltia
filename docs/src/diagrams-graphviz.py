import graphviz

CREAM="#faf8f5"; INK="#24211e"; TERRA="#c85a32"; SAND="#f0e7dc"; LINE="#8c8278"; GREEN="#335928"; BLUE="#1f4e79"
base = dict(fontname="Helvetica", fontsize="11")

# ---------------------------------------------------------------- 1. End-to-end content update flow
g = graphviz.Digraph("flow", format="png")
g.attr(rankdir="LR", bgcolor="white", pad="0.3", nodesep="0.35", ranksep="0.55", dpi="170", **base)
g.attr("node", shape="box", style="rounded,filled", fillcolor=SAND, color=LINE, fontcolor=INK, **base)
g.attr("edge", color=LINE, fontcolor=INK, fontsize="9", fontname="Helvetica", arrowsize="0.8")

with g.subgraph(name="cluster_mgr") as c:
    c.attr(label="Pizza manager (browser)", style="rounded,filled", fillcolor=CREAM, color=LINE, fontname="Helvetica-Bold", fontsize="11")
    c.node("open", "Open the editor URL\n/admin/ (unlisted)")
    c.node("login", "Sign in with GitHub\n(or access token)")
    c.node("edit", "Edit Menu / Blog /\nAnnouncement / Hours")
    c.node("validate", "Form validation\n(required, lengths,\nno < > / HTML)", fillcolor="#fbeee8", color=TERRA)
    c.node("save", "Save")
    c.node("review", "“Send for Review”")

with g.subgraph(name="cluster_gh") as c:
    c.attr(label="GitHub (API)", style="rounded,filled", fillcolor=CREAM, color=LINE, fontname="Helvetica-Bold", fontsize="11")
    c.node("authz", "Collaborator check\n/repos/…/collaborators/{user}", fillcolor="#fbeee8", color=TERRA)
    c.node("branch", "Create branch\ncms/<collection>/<slug>\nfrom main")
    c.node("commit", "Commit changed file(s)\n(createCommitOnBranch)")
    c.node("pr", "Open DRAFT pull request\n→ main\nlabel sveltia-cms/draft")
    c.node("ready", "Mark PR ready for review\nlabel sveltia-cms/pending_review")

with g.subgraph(name="cluster_ci") as c:
    c.attr(label="GitHub Actions", style="rounded,filled", fillcolor=CREAM, color=LINE, fontname="Helvetica-Bold", fontsize="11")
    c.node("prcheck", "PR check\nvalidate:content · lint · build", fillcolor="#e9f0e6", color=GREEN)
    c.node("deploy", "Deploy workflow\nvalidate → build → Pages", fillcolor="#e9f0e6", color=GREEN)

with g.subgraph(name="cluster_rev") as c:
    c.attr(label="Reviewer (owner / developer)", style="rounded,filled", fillcolor=CREAM, color=LINE, fontname="Helvetica-Bold", fontsize="11")
    c.node("approve", "Review diff,\napprove")
    c.node("merge", "Squash & merge\nto main")

g.node("live", "Site updated on\nGitHub Pages", shape="box", style="rounded,filled", fillcolor=INK, fontcolor="white", color=INK)

g.edge("open", "login"); g.edge("login", "authz"); g.edge("authz", "edit", label="granted")
g.edge("edit", "validate"); g.edge("validate", "edit", label="errors", style="dashed", color=TERRA)
g.edge("validate", "save", label="ok"); g.edge("save", "branch"); g.edge("branch", "commit"); g.edge("commit", "pr")
g.edge("pr", "review", style="dashed", label="prompt"); g.edge("review", "ready")
g.edge("ready", "prcheck", label="on pull_request"); g.edge("prcheck", "approve", label="✓ status")
g.edge("approve", "merge"); g.edge("merge", "deploy", label="on push main"); g.edge("deploy", "live")
g.render("content-update-flow", cleanup=True)

# ---------------------------------------------------------------- 2. Architecture / components
a = graphviz.Digraph("arch", format="png")
a.attr(rankdir="TB", bgcolor="white", pad="0.3", nodesep="0.4", ranksep="0.5", dpi="170", **base)
a.attr("node", shape="box", style="rounded,filled", fillcolor=SAND, color=LINE, fontcolor=INK, **base)
a.attr("edge", color=LINE, fontcolor=INK, fontsize="9", fontname="Helvetica", arrowsize="0.8")

with a.subgraph(name="cluster_repo") as c:
    c.attr(label="Git repository  smagara/SlowDoughPizzaSite_Sveltia", style="rounded,filled", fillcolor=CREAM, color=LINE, fontname="Helvetica-Bold")
    c.node("content", "content/\nmenu.json · announcement.json\nhours.json · blog/*.md", fillcolor="#fbeee8", color=TERRA)
    c.node("cfg", "src/admin/config.ts\n(typed Sveltia config =\nsingle source of field rules)")
    c.node("site", "src/  React components\nsrc/content/index.ts loader\nMarkdown.tsx (safe renderer)")
    c.node("tools", "tools/ Vite plugins\nmarkdown front matter · CSP")
    c.node("validator", "scripts/validate-content.ts\n(CI re-validation)")
    c.node("wf", ".github/workflows\npr-check.yml · deploy.yml")

with a.subgraph(name="cluster_build") as c:
    c.attr(label="Build (Vite 8)", style="rounded,filled", fillcolor=CREAM, color=LINE, fontname="Helvetica-Bold")
    c.node("distsite", "dist/index.html\npublic site (+ meta CSP)")
    c.node("distadmin", "dist/admin/index.html\nSveltia CMS bundle\n+ site theme")

with a.subgraph(name="cluster_run") as c:
    c.attr(label="Runtime", style="rounded,filled", fillcolor=CREAM, color=LINE, fontname="Helvetica-Bold")
    c.node("pages", "GitHub Pages\n(static hosting)")
    c.node("browser", "Manager's browser\nSveltia CMS SPA")
    c.node("ghapi", "GitHub REST + GraphQL API\n(contents, refs, pulls, labels)")
    c.node("oauth", "OAuth helper\n(Sveltia CMS Authenticator\non Cloudflare Workers)\n— optional; token sign-in otherwise", style="rounded,filled,dashed")

a.edge("content", "site", label="import at build time"); a.edge("cfg", "distadmin"); a.edge("cfg", "validator", label="reuses rules")
a.edge("site", "distsite"); a.edge("tools", "distsite"); a.edge("tools", "site")
a.edge("wf", "validator", label="runs"); a.edge("wf", "pages", label="deploys dist/")
a.edge("distsite", "pages"); a.edge("distadmin", "pages")
a.edge("pages", "browser", label="loads /admin/"); a.edge("browser", "oauth", label="sign in", style="dashed"); a.edge("browser", "ghapi", label="read files,\nbranches, PRs")
a.edge("ghapi", "content", label="commits on\ncms/* branches", style="dashed")
a.render("architecture", cleanup=True)

# ---------------------------------------------------------------- 3. Local dev mode
l = graphviz.Digraph("local", format="png")
l.attr(rankdir="LR", bgcolor="white", pad="0.3", nodesep="0.35", ranksep="0.5", dpi="170", **base)
l.attr("node", shape="box", style="rounded,filled", fillcolor=SAND, color=LINE, fontcolor=INK, **base)
l.attr("edge", color=LINE, fontcolor=INK, fontsize="9", fontname="Helvetica", arrowsize="0.8")
l.node("dev", "npm run dev\nhttp://localhost:3000")
l.node("admin", "/admin/ on localhost\n“Work with Local Repository”")
l.node("picker", "Browser directory picker\n(File System Access API,\nChrome / Edge)")
l.node("fs", "content/*.json, blog/*.md\nwritten directly to the\nworking copy", fillcolor="#fbeee8", color=TERRA)
l.node("hmr", "Vite watches files →\nsite hot-reloads")
l.node("git", "Developer reviews diff,\ncommits with git\n(or discards)")
l.edge("dev", "admin"); l.edge("admin", "picker"); l.edge("picker", "fs", label="save"); l.edge("fs", "hmr"); l.edge("fs", "git")
l.render("local-dev-mode", cleanup=True)

# ---------------------------------------------------------------- 4. Validation layers
v = graphviz.Digraph("layers", format="png")
v.attr(rankdir="LR", bgcolor="white", pad="0.3", nodesep="0.3", ranksep="0.45", dpi="170", **base)
v.attr("node", shape="box", style="rounded,filled", fillcolor=SAND, color=LINE, fontcolor=INK, **base)
v.attr("edge", color=LINE, arrowsize="0.8")
v.node("in", "Free text typed\nby the manager", fillcolor="white")
v.node("l1", "1 · Editor form rules\nrequired · min/max length\nregex: no < > (text)\nno HTML tags (Markdown)\nfixed option lists", fillcolor="#fbeee8", color=TERRA)
v.node("l2", "2 · Pull request review\nhuman reads the diff", fillcolor="#fbeee8", color=TERRA)
v.node("l3", "3 · CI validator\nsame rules re-applied\nfrom config.ts + HTML /\njavascript: / on*= scan\n→ blocks merge & deploy", fillcolor="#e9f0e6", color=GREEN)
v.node("l4", "4 · Safe rendering\nReact escapes all text;\nreact-markdown: no raw HTML,\nelement whitelist, safe URLs", fillcolor="#e9f0e6", color=GREEN)
v.node("l5", "5 · Browser CSP\nscript-src 'self'\nno inline scripts", fillcolor="#e9f0e6", color=GREEN)
v.node("out", "Rendered page", fillcolor="white")
v.edge("in","l1"); v.edge("l1","l2"); v.edge("l2","l3"); v.edge("l3","l4"); v.edge("l4","l5"); v.edge("l5","out")
v.render("validation-layers", cleanup=True)
print("ok")
