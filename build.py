#!/usr/bin/env python3
"""
build.py — 분할된 섹션 파일들을 하나의 index.html로 조립
GitHub Actions에서 자동 실행됩니다. 직접 실행할 필요 없습니다.
"""
import os, re

BASE = os.path.dirname(__file__)
CODE = os.path.join(BASE, 'code')
OUT  = os.path.join(BASE, '_site', 'index.html')

os.makedirs(os.path.join(BASE, '_site'), exist_ok=True)

def read(path):
    return open(os.path.join(CODE, path), encoding='utf-8').read()

# CSS & JS에서 태그 내용만 추출 (주석 헤더 유지)
style_content = read('css/style.css')
js_content    = read('js/main.js')

sections = [
    'sections/nav.html',
    'sections/hero.html',
    'sections/configurator.html',
    'sections/wizard.html',
    'sections/result.html',
    'sections/guide.html',
    'sections/intro.html',
    'sections/clients.html',
    'sections/b2b.html',
    'sections/cta.html',
    'sections/events.html',
    'sections/footer.html',
    'sections/modals.html',
]

body_parts = [read(s) for s in sections]

html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>롯데백화점 동탄점 — 기업 전용 기프트 컨시어지</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Nanum+Barun+Gothic:wght@400;700&display=swap" rel="stylesheet">
<style>
{style_content}
</style>
</head>
<body>
{''.join(body_parts)}
<script>
{js_content}
</script>
</body>
</html>"""

open(OUT, 'w', encoding='utf-8').write(html)
print(f"✓ 빌드 완료: {OUT} ({len(html):,} bytes)")
