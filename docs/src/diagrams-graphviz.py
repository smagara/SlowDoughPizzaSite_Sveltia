import graphviz
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parents[1] / "images" / "diagrams"  # run from any directory
OUT_DIR.mkdir(parents=True, exist_ok=True)

CREAM="#faf8f5"; INK="#24211e"; TERRA="#c85a32"; SAND="#f0e7dc"; LINE="#8c8278"; GREEN="#335928"; BLUE="#1f4e79"
base = dict(fontname="Helvetica", fontsize="11")

# (The content-update-flow and architecture diagrams are drawn by diagram-content-update-flow.py and
#  diagram-architecture.py; this script only renders the two Graphviz diagrams below.)

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
l.render(str(OUT_DIR / "local-dev-mode"), cleanup=True)

# ---------------------------------------------------------------- 4. Validation layers
v = graphviz.Digraph("layers", format="png")
v.attr(rankdir="LR", bgcolor="white", pad="0.3", nodesep="0.3", ranksep="0.45", dpi="170", **base)
v.attr("node", shape="box", style="rounded,filled", fillcolor=SAND, color=LINE, fontcolor=INK, **base)
v.attr("edge", color=LINE, arrowsize="0.8")
v.node("in", "Free text typed\nby the manager", fillcolor="white")
v.node("l1", "1 · Editor form rules\nrequired · min/max length\nregex: no < > (text)\nno HTML tags (Markdown)\nfixed option lists", fillcolor="#fbeee8", color=TERRA)
v.node("l2", "2 · Manager review in the editor\n(site-styled preview); the PR\nstays unmergeable until “Ready”", fillcolor="#fbeee8", color=TERRA)
v.node("l3", "3 · CI validator + publish gate\nsame rules re-applied\nfrom config.ts + HTML /\njavascript: / on*= scan\n→ no merge without a green check", fillcolor="#e9f0e6", color=GREEN)
v.node("l4", "4 · Safe rendering\nReact escapes all text;\nreact-markdown: no raw HTML,\nelement whitelist, safe URLs", fillcolor="#e9f0e6", color=GREEN)
v.node("l5", "5 · Browser CSP\nscript-src 'self'\nno inline scripts", fillcolor="#e9f0e6", color=GREEN)
v.node("out", "Rendered page", fillcolor="white")
v.edge("in","l1"); v.edge("l1","l2"); v.edge("l2","l3"); v.edge("l3","l4"); v.edge("l4","l5"); v.edge("l5","out")
v.render(str(OUT_DIR / "validation-layers"), cleanup=True)
print("saved", OUT_DIR)
