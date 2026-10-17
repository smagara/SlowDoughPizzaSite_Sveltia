from PIL import Image, ImageDraw
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from diagram_common import OUT_DIR, font  # noqa: E402  (cross-platform fonts, output folder)

W, H = 2880, 1500
SCALE = 1
img = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(img)
F = font(23); FB = font(26, True); FS = font(20); FL = font(28, True); FT = font(36, True)

INK="#24211e"; TERRA="#c85a32"; SAND="#f0e7dc"; CREAM="#faf8f5"; LINE="#8c8278"; GREEN="#335928"; GREENBG="#e9f0e6"; REDBG="#fbeee8"

# lanes
lanes = ["Editor (staff)\n(browser, /admin)", "GitHub\n(repository & API)", "GitHub Actions\n(CI / CD)", "Reviewer (manager)\n(in the editor)"]
top, left = 120, 40
lane_h = (H - top - 40) / len(lanes)
label_w = 300
d.text((left, 40), "Content update flow — from the editor to the live site", font=FT, fill=INK)
for i, name in enumerate(lanes):
    y0 = top + i * lane_h; y1 = y0 + lane_h
    d.rectangle([left, y0, W - 40, y1], fill=CREAM if i % 2 == 0 else "white", outline=LINE, width=2)
    d.rectangle([left, y0, left + label_w, y1], fill=SAND, outline=LINE, width=2)
    lines = name.split("\n")
    th = sum(FL.getbbox(l)[3] + 8 for l in lines)
    yy = y0 + (lane_h - th) / 2
    for l in lines:
        w = FL.getlength(l) if hasattr(FL, "getlength") else d.textlength(l, font=FL)
        d.text((left + (label_w - w) / 2, yy), l, font=FL, fill=INK); yy += FL.getbbox(l)[3] + 8

def lane_y(i): return top + i * lane_h + lane_h / 2

boxes = {}
def box(key, lane, x, text, w=290, h=150, fill=SAND, outline=LINE, num=None, fg=INK):
    cy = lane_y(lane); x0, y0, x1, y1 = x, cy - h / 2, x + w, cy + h / 2
    d.rounded_rectangle([x0, y0, x1, y1], radius=18, fill=fill, outline=outline, width=3)
    lines = text.split("\n")
    th = sum(F.getbbox(l)[3] + 6 for l in lines)
    yy = y0 + (h - th) / 2
    for l in lines:
        w_ = d.textlength(l, font=F)
        d.text((x0 + (w - w_) / 2, yy), l, font=F, fill=fg); yy += F.getbbox(l)[3] + 6
    if num is not None:
        r = 22
        d.ellipse([x0 - r + 6, y0 - r + 6, x0 + r + 6, y0 + r + 6], fill=TERRA)
        s = str(num); w_ = d.textlength(s, font=FB)
        d.text((x0 + 6 - w_ / 2, y0 + 6 - FB.getbbox(s)[3] / 2 - 3), s, font=FB, fill="white")
    boxes[key] = (x0, y0, x1, y1)

def seg(p, q, dashed, color):
    x0, y0 = p; x1, y1 = q
    if not dashed:
        d.line([p, q], fill=color, width=4); return
    L = math.hypot(x1 - x0, y1 - y0); n = max(int(L / 16), 1)
    for k in range(0, n, 2):
        t0 = k / n; t1 = min((k + 1) / n, 1)
        d.line([x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0, x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1], fill=color, width=4)

def head(p, q, color):
    (x0, y0), (x1, y1) = p, q
    ang = math.atan2(y1 - y0, x1 - x0); L = 18
    d.polygon([(x1, y1), (x1 - L * math.cos(ang - 0.5), y1 - L * math.sin(ang - 0.5)), (x1 - L * math.cos(ang + 0.5), y1 - L * math.sin(ang + 0.5))], fill=color)

def put_label(label, lx, ly):
    w_ = d.textlength(label, font=FS); h_ = FS.getbbox(label)[3]
    d.rectangle([lx - w_ / 2 - 6, ly - h_ / 2 - 8, lx + w_ / 2 + 6, ly + h_ / 2 + 4], fill="white")
    d.text((lx - w_ / 2, ly - h_ / 2 - 4), label, font=FS, fill=INK)

def arrow(a, b, label=None, dashed=False, color=LINE):
    ax0, ay0, ax1, ay1 = boxes[a]; bx0, by0, bx1, by1 = boxes[b]
    acx, acy = (ax0 + ax1) / 2, (ay0 + ay1) / 2; bcx, bcy = (bx0 + bx1) / 2, (by0 + by1) / 2
    if abs(acy - bcy) < 5:                       # same lane: right edge → left edge
        p, q = (ax1, acy), (bx0, bcy); seg(p, q, dashed, color); head(p, q, color)
        if label: put_label(label, (p[0] + q[0]) / 2, min(ay0, by0) - 30)  # above both boxes, not inside the gap
        return
    down = bcy > acy
    if abs(acx - bcx) < 5:                       # same column: straight vertical
        start = (acx, ay1 if down else ay0); end = (bcx, by0 if down else by1)
        seg(start, end, dashed, color); head(start, end, color)
        if label: put_label(label, acx + 110, (start[1] + end[1]) / 2)
        return
    if down:                                     # vertical to target lane centre, then horizontal
        start = (acx, ay1); corner = (acx, bcy); end = (bx0 if bcx > acx else bx1, bcy)
        seg(start, corner, dashed, color); seg(corner, end, dashed, color); head(corner, end, color)
        if label: put_label(label, (corner[0] + end[0]) / 2, bcy - 28)
    else:                                        # horizontal first, then vertical up into target
        start = (ax1 if bcx > acx else ax0, acy); corner = (bcx, acy); end = (bcx, by1)
        seg(start, corner, dashed, color); seg(corner, end, dashed, color); head(corner, end, color)
        if label: put_label(label, (start[0] + corner[0]) / 2, acy - 28)

X = left + label_w + 50; G = 48; BW = 300
xs = [X + i * (BW + G) for i in range(7)]
# lane 0 (manager)
box("open", 0, xs[0], "Open the editor URL\n(bookmark, not linked\nfrom the site) · sign in", num=1)
box("edit", 0, xs[1], "Edit a menu item,\nsection, blog post,\nbanner or hours", num=3)
box("val", 0, xs[2], "Form validation\nrequired · max length\nno < > or HTML tags", fill=REDBG, outline=TERRA, num=4)
box("save", 0, xs[3], "Save\n(changes stay on a\nseparate branch)", num=5)
box("send", 0, xs[4], "“Send for Review”", num=7)
box("live", 0, xs[6], "Site updated ✓\nminutes after “Ready” —\nno GitHub visit needed", fill=INK, outline=INK, fg="white", num=13)
# lane 1 (github)
box("authz", 1, xs[0], "Collaborator check\n(only repo collaborators\nwith write access)", fill=REDBG, outline=TERRA, num=2)
box("branch", 1, xs[3], "New branch\ncms/<collection>/<slug>\n+ commit + DRAFT\npull request → main", num=6, h=170)
box("ready", 1, xs[4], "PR ready for review,\nlabel pending_review;\nstatus sveltia/workflow\n= pending (merge blocked)", num=8, h=170)
# lane 2 (actions)
box("prcheck", 2, xs[4], "PR check\nvalidate:content · lint\nunit tests · build", fill=GREENBG, outline=GREEN, num=9)
box("gate", 2, xs[5], "CMS publish gate\nReady + green check →\nstatus success, squash-\nmerge, dispatch deploy", fill=GREENBG, outline=GREEN, num=11, h=170)
box("deploy", 2, xs[6], "Deploy workflow\nvalidate → build →\npublish to GitHub Pages", fill=GREENBG, outline=GREEN, num=12)
# lane 3 (reviewer)
box("review", 3, xs[5], "Open the card, check\nthe preview, move it\nto “Ready” (label\npending_publish)", num=10, h=170)

arrow("open", "authz")
arrow("authz", "edit", label="granted")
arrow("edit", "val"); arrow("val", "save", label="ok")
arrow("save", "branch")
arrow("save", "send", label="then prompt", dashed=True)
arrow("send", "ready")
arrow("ready", "prcheck", label="pull_request")
arrow("prcheck", "gate", label="check result")
arrow("review", "gate", label="labeled Ready")
arrow("gate", "deploy", label="workflow_dispatch")
arrow("deploy", "live")
# errors loop label
ex0, ey0, ex1, ey1 = boxes["val"]
d.text((ex0 + 20, ey0 - 40), "errors → fix and retry", font=FS, fill=TERRA)
# reviewer sees the card in the editor's In Review lane
rx0, ry0, rx1, ry1 = boxes["review"]
d.text((rx0 - 300, ry0 + 60), "card appears in the\neditor’s “In Review” lane", font=FS, fill=LINE)

img.save(OUT_DIR / "content-update-flow.png")
print("saved", OUT_DIR / ("content-update-flow.png" if "flow" in __file__ else "architecture.png"))
