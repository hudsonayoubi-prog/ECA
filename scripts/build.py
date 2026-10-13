"""Build the single-file app.

Joins src/head.html (title, fonts, CSS), src/data/data.json (seed data) and src/app.js (all logic) into:
  public/index.html  - the published page (React, ReactDOM and htm load from pinned CDN URLs)
  tests/index.html   - the same page wired to local node_modules for offline Playwright tests
Run from the repository root:  python3 scripts/build.py
"""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(ROOT, p), encoding='utf-8').read()
head = rd('src/head.html'); js = rd('src/app.js'); data = rd('src/data/data.json').replace('</', '<\\/')
CDN = {
    'react': 'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js',
    'react-dom': 'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js',
    'htm': 'https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.umd.js',
}
cdn = '\n'.join(f'<script src="{u}"></script>' for u in CDN.values())
page = head + '\n<div id="app"></div>\n<noscript>This app needs JavaScript.</noscript>\n<script id="seed" type="application/json">' + data + '</script>\n' + cdn + '\n<script>\n' + js + '\n</script>\n'
open(os.path.join(ROOT, 'public/index.html'), 'w', encoding='utf-8').write(page)
local = (page.replace(CDN['react'], '../node_modules/react/umd/react.development.js')
             .replace(CDN['react-dom'], '../node_modules/react-dom/umd/react-dom.development.js')
             .replace(CDN['htm'], '../node_modules/htm/dist/htm.umd.js')
             .replace('<link rel="stylesheet" href="https://fonts.googleapis.com', '<link rel="x" href="https://fonts.googleapis.com'))
open(os.path.join(ROOT, 'tests/index.html'), 'w', encoding='utf-8').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + local + '</body></html>')
print('Built public/index.html and tests/index.html')
