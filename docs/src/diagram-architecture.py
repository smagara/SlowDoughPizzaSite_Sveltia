from PIL import Image, ImageDraw, ImageFont
import math
W, H = 2520, 1380
img = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(img)
def font(size, bold=False):
    return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size)
F = font(23); FB = font(25, True); FS = font(20); FL = font(28, True); FT = font(36, True)
INK="#24211e"; TERRA="#c85a32"; SAND="#f0e7dc"; CREAM="#faf8f5"; LINE="#8c8278"; GREEN="#335928"; GREENBG="#e9f0e6"; REDBG="#fbeee8"
d.text((40, 40), "System architecture — repository, build pipeline and runtime", font=FT, fill=INK)

def panel(x0, y0, x1, y1, title, fill=CREAM):
    d.rounded_rectangle([x0, y0, x1, y1], radius=24, fill=fill, outline=LINE, width=3)
    d.text((x0 + 24, y0 + 18), title, font=FL, fill=INK)

boxes = {}
def box(key, x, y, text, w=430, h=150, fill=SAND, outline=LINE, fg=INK, dashed=False, small=False):
    x0, y0, x1, y1 = x, y, x + w, y + h
    d.rounded_rectangle([x0, y0, x1, y1], radius=18, fill=fill, outline=outline, width=3)
    if dashed:
        d.rounded_rectangle([x0, y0, x1, y1], radius=18, fill=fill, outline="white", width=3)
        # dashed border
        pts = []
        per = 2 * (x1 - x0) + 2 * (y1 - y0)
        for k in range(0, int(per), 22):
            t = k
            if t < (x1 - x0): p = (x0 + t, y0)
            elif t < (x1 - x0) + (y1 - y0): p = (x1, y0 + t - (x1 - x0))
            elif t < 2 * (x1 - x0) + (y1 - y0): p = (x1 - (t - (x1 - x0) - (y1 - y0)), y1)
            else: p = (x0, y1 - (t - 2 * (x1 - x0) - (y1 - y0)))
            pts.append(p)
        for i in range(0, len(pts) - 1, 2): d.line([pts[i], pts[i + 1]], fill=outline, width=3)
    f = FS if small else F
    lines = text.split("\n"); th = sum(f.getbbox(l)[3] + 6 for l in lines); yy = y0 + (h - th) / 2
    for l in lines:
        w_ = d.textlength(l, font=f); d.text((x0 + (w - w_) / 2, yy), l, font=f, fill=fg); yy += f.getbbox(l)[3] + 6
    boxes[key] = (x0, y0, x1, y1)

def head(p, q, color):
    (x0, y0), (x1, y1) = p, q; ang = math.atan2(y1 - y0, x1 - x0); L = 18
    d.polygon([(x1, y1), (x1 - L * math.cos(ang - 0.5), y1 - L * math.sin(ang - 0.5)), (x1 - L * math.cos(ang + 0.5), y1 - L * math.sin(ang + 0.5))], fill=color)
def seg(p, q, dashed, color):
    if not dashed: d.line([p, q], fill=color, width=4); return
    x0, y0 = p; x1, y1 = q; L = math.hypot(x1 - x0, y1 - y0); n = max(int(L / 16), 1)
    for k in range(0, n, 2):
        t0 = k / n; t1 = min((k + 1) / n, 1); d.line([x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0, x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1], fill=color, width=4)
def label(text, x, y):
    w_ = d.textlength(text, font=FS); h_ = FS.getbbox(text)[3]
    d.rectangle([x - w_ / 2 - 6, y - h_ / 2 - 8, x + w_ / 2 + 6, y + h_ / 2 + 4], fill="white"); d.text((x - w_ / 2, y - h_ / 2 - 4), text, font=FS, fill=INK)
def arrow(a, b, text=None, dashed=False, color=LINE, side=None):
    ax0, ay0, ax1, ay1 = boxes[a]; bx0, by0, bx1, by1 = boxes[b]
    acx, acy = (ax0 + ax1) / 2, (ay0 + ay1) / 2; bcx, bcy = (bx0 + bx1) / 2, (by0 + by1) / 2
    if side == "h" or (abs(acy - bcy) < 5):
        p = (ax1, acy) if bcx > acx else (ax0, acy); q = (bx0, bcy) if bcx > acx else (bx1, bcy)
        seg(p, q, dashed, color); head(p, q, color)
        if text: label(text, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2 - 28)
        return
    if abs(acx - bcx) < 5:
        p = (acx, ay1 if bcy > acy else ay0); q = (bcx, by0 if bcy > acy else by1)
        seg(p, q, dashed, color); head(p, q, color)
        if text: label(text, acx + 120, (p[1] + q[1]) / 2)
        return
    # vertical then horizontal
    p = (acx, ay1 if bcy > acy else ay0); c = (acx, bcy); q = (bx0 if bcx > acx else bx1, bcy)
    seg(p, c, dashed, color); seg(c, q, dashed, color); head(c, q, color)
    if text: label(text, (c[0] + q[0]) / 2, bcy - 28)

# ---- panels
panel(40, 110, 1160, 1330, "Git repository  ·  smagara/SlowDoughPizzaSite_Sveltia  (branch main)")
panel(1200, 110, 1780, 700, "GitHub Actions (CI / CD)", fill="#f4f7f2")
panel(1820, 110, 2480, 1330, "Runtime")
panel(1200, 740, 1780, 1330, "Local development", fill="white")

# repo
box("content", 80, 190, "content/\nmenu.json · announcement.json\nhours.json · blog/*.md\n(the only files editors change)", w=500, h=180, fill=REDBG, outline=TERRA)
box("config", 620, 190, "src/admin/config.ts\ntyped Sveltia CMS config —\ncollections, fields, validation\nrules, workflow settings", w=500, h=180)
box("loader", 80, 440, "src/content/index.ts\ntyped loader (+ ids, sorting,\nread time) → React components\nMarkdown.tsx safe renderer", w=500, h=180)
box("adminsrc", 620, 440, "src/admin/main.ts + theme.css\nadmin/index.html\nboots @sveltia/cms with the\nconfig, site-themed skin", w=500, h=180)
box("tools", 80, 690, "tools/ Vite plugins\n• Markdown + YAML front matter\n  → JSON modules at build time\n• build-only <meta> CSP", w=500, h=180)
box("validator", 620, 690, "scripts/validate-content.ts\nre-applies the config.ts rules\n+ HTML / script scan to every\nfile under content/", w=500, h=180)
box("workflows", 80, 1150, ".github/workflows/\npr-check.yml  (every PR)\ndeploy.yml  (push to main)", w=500, h=130)
box("tests", 620, 1150, "tests/e2e/  offline end-to-end test:\nsimulated GitHub API + fake local\nfile system (Playwright)", w=500, h=130)
box("dist", 80, 940, "npm run build  →  dist/\nindex.html (site, meta CSP)  ·  admin/index.html (editor)  ·  assets/", w=1040, h=120)

# actions
box("prcheck", 1240, 190, "PR check\nvalidate:content · lint · build\n→ required status check", w=500, h=150, fill=GREENBG, outline=GREEN)
box("deploy", 1240, 400, "Deploy to GitHub Pages\nvalidate → npm run build\n(BASE_PATH, OAuth URL) → deploy", w=500, h=150, fill=GREENBG, outline=GREEN)
box("protect", 1240, 590, "Branch protection on main:\nPR + 1 approval + green PR check", w=500, h=80, small=True)

# runtime
box("pages", 1860, 190, "GitHub Pages (static)\nsmagara.github.io/\nSlowDoughPizzaSite_Sveltia/", w=580, h=150, fill=INK, outline=INK, fg="white")
box("visitor", 1860, 420, "Visitors\npublic site", w=260, h=110)
box("manager", 2180, 420, "Manager\n/admin/ editor (SPA)", w=260, h=110)
box("oauth", 1860, 640, "OAuth helper (optional)\nSveltia CMS Authenticator\non Cloudflare Workers\n(else: access-token sign-in)", w=580, h=150, dashed=True)
box("ghapi", 1860, 880, "GitHub REST + GraphQL API\n• /user, collaborator check\n• git trees / blobs (read)\n• createRef · createCommitOnBranch\n• pulls · labels · ready-for-review", w=580, h=210)
box("repo2", 1860, 1150, "Repository: branches cms/<collection>/<slug>\npull requests → main", w=580, h=110, fill=REDBG, outline=TERRA)

# local dev
box("dev", 1240, 830, "npm run dev → localhost:3000\n/admin/ → “Work with Local\nRepository” (File System\nAccess API, Chrome/Edge)", w=500, h=180)
box("write", 1240, 1070, "writes content/* directly;\nVite hot-reloads the site;\ndeveloper commits with git", w=500, h=150)

# edges (hand-routed polylines to avoid crossing boxes)
def poly(points, text=None, dashed=False, color=LINE, at=None, both=False):
    for k in range(len(points) - 1): seg(points[k], points[k + 1], dashed, color)
    head(points[-2], points[-1], color)
    if both: head(points[1], points[0], color)
    if text:
        p = at or ((points[0][0] + points[1][0]) / 2, (points[0][1] + points[1][1]) / 2 - 28)
        label(text, *p)

poly([(330, 370), (330, 440)], "imported at build time", at=(470, 405))
poly([(870, 370), (870, 440)])
poly([(1120, 280), (1142, 280), (1142, 780), (1120, 780)], "same rules", dashed=True, at=(1060, 650))
poly([(330, 870), (330, 940)], "vite build", at=(430, 905))
poly([(870, 870), (870, 940)])
# workflows → actions
poly([(1120, 1215), (1180, 1215), (1180, 265), (1240, 265)], "pull_request", at=(1180, 240))
poly([(1180, 475), (1240, 475)], "push to main", at=(1180, 450))
# deploy → pages
poly([(1740, 475), (1800, 475), (1800, 265), (1860, 265)])
# pages → visitor / manager
poly([(1990, 340), (1990, 420)]); poly([(2310, 340), (2310, 420)])
# manager → oauth (dashed), → ghapi
poly([(2310, 530), (2310, 640)], "sign in", dashed=True, at=(2390, 585))
poly([(2440, 475), (2462, 475), (2462, 985), (2440, 985)], "read / write", at=(2400, 830))
poly([(2150, 1090), (2150, 1150)])
poly([(1490, 1010), (1490, 1070)])
d.text((1220, 1290), "PR approved & merged into main  →  deploy.yml runs  →  site updated", font=FS, fill=GREEN)
img.save("architecture.png"); print("saved")
