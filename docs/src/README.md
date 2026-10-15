# Documentation sources

The deliverables in `docs/` are generated from these sources so they can be refreshed when the
implementation changes. Screenshots under `docs/images/cms/` are produced by `npm run test:e2e`.

| Output | Source | Build |
|---|---|---|
| `docs/images/diagrams/content-update-flow.png` | `diagram-content-update-flow.py` (Pillow) | `python3 diagram-content-update-flow.py` (run inside `docs/images/diagrams/`) |
| `docs/images/diagrams/architecture.png` | `diagram-architecture.py` (Pillow) | `python3 diagram-architecture.py` (same directory) |
| `docs/images/diagrams/local-dev-mode.png`, `validation-layers.png` | `diagrams-graphviz.py` (graphviz) | `python3 diagrams-graphviz.py` (same directory) |
| `docs/Technical-Design-Document.docx` | `build-tdd.py` (python-docx) | `python3 build-tdd.py` |
| `docs/Manager-Quick-Guide.pdf` | `manager-quick-guide.html` (+ cropped screenshots in `docs/images/guide/`) | print to PDF (A4, background graphics) from Chrome, e.g. with Playwright: `page.pdf(format='A4', print_background=True)` |

Python requirements: `python-docx`, `Pillow`, `graphviz` (+ the `dot` binary), `playwright` (for the PDF).
