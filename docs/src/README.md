# Documentation sources

The deliverables in `docs/` are generated from these sources so they can be refreshed when the
implementation changes. Screenshots under `docs/images/cms/` come from the end-to-end test
(`UPDATE_SCREENSHOTS=1 npm run test:e2e`).

## Setup (once)

```bash
pip install -r docs/src/requirements.txt
python -m playwright install chromium          # only needed for the PDF export
```

`diagrams-graphviz.py` additionally needs the Graphviz **dot** executable on the PATH
(Linux: `apt install graphviz`; Windows: installer from graphviz.org or `winget install Graphviz.Graphviz`;
macOS: `brew install graphviz`). The Pillow-drawn diagrams and the Word document need nothing else.

## Building

All scripts resolve their output folder from their own location, so they can be run from any
directory — no `cd` required. Use `python` instead of `python3` on Windows if that is how Python is
installed.

| Output | Source | Command (from the repository root) |
|---|---|---|
| `docs/images/diagrams/content-update-flow.png` | `diagram-content-update-flow.py` (Pillow) | `python docs/src/diagram-content-update-flow.py` |
| `docs/images/diagrams/architecture.png` | `diagram-architecture.py` (Pillow) | `python docs/src/diagram-architecture.py` |
| `docs/images/diagrams/local-dev-mode.png`, `validation-layers.png` | `diagrams-graphviz.py` (Graphviz) | `python docs/src/diagrams-graphviz.py` |
| `docs/Technical-Design-Document.docx` | `build-tdd.py` (python-docx) | `python docs/src/build-tdd.py` |
| `docs/Manager-Quick-Guide.pdf` | `manager-quick-guide.html` (+ cropped screenshots in `docs/images/guide/`) | `python docs/src/build-guide-pdf.py` |

Fonts: the Pillow diagrams use the first font they find from a cross-platform list (DejaVu Sans on
Linux, Segoe UI / Arial on Windows, Arial on macOS — see `diagram_common.py`). If none is found they
fall back to Pillow's built-in font with a warning instead of failing.

Order when everything changed: screenshots (e2e) → diagrams → `build-tdd.py` → `build-guide-pdf.py`.
