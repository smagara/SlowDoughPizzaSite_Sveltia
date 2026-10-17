"""
Render docs/Manager-Quick-Guide.pdf from manager-quick-guide.html with headless Chromium
(Playwright). Run from any directory:  python docs/src/build-guide-pdf.py
Requires:  pip install playwright  &&  python -m playwright install chromium
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

SRC = Path(__file__).resolve().parent / "manager-quick-guide.html"
OUT = Path(__file__).resolve().parents[1] / "Manager-Quick-Guide.pdf"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto(SRC.as_uri(), wait_until="networkidle")
    page.emulate_media(media="print")
    page.pdf(path=str(OUT), format="A4", print_background=True, prefer_css_page_size=True)
    browser.close()

print("saved", OUT)
