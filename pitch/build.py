"""Gera public/index.html (página completa para a Vercel) a partir de index.html."""
import os
src = open('index.html', encoding='utf-8').read()
head, body = src.split('</style>', 1)
og = '''<meta property="og:title" content="Mateus no CoE">
<meta property="og:description" content="Um quiz rápido para quem está decidindo quem entra no time.">
<meta property="og:type" content="website">
<meta name="theme-color" content="#050B1C">
'''
page = ('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        + og + head + '</style>\n</head>\n<body>\n' + body + '\n</body>\n</html>\n')
os.makedirs('public', exist_ok=True)
open('public/index.html', 'w', encoding='utf-8').write(page)
