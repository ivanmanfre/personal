"""Stage dist-preview/<name>.html pages with the scan row and its remote images inlined.
The artifact sandbox blocks outside fetches and outside images, so the page must carry both."""
import hashlib, json, os, re, shutil, sys, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist-preview')
env = {}
for f in ('.env', '.env.local'):
    p = os.path.join(ROOT, f)
    if os.path.exists(p):
        for line in open(p):
            if '=' in line and not line.lstrip().startswith('#'):
                k, v = line.strip().split('=', 1); env[k] = v.strip().strip('"')
URL, KEY = env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']
IMG = re.compile(r'https?://[^"\s]+?(?:\.(?:png|jpe?g|webp|svg|gif)|/storage/v1/object/public/[^"\s]+)', re.I)
os.makedirs(os.path.join(DIST, 'remote'), exist_ok=True)
tpl = open(os.path.join(DIST, 'index.html')).read()
for pair in sys.argv[1:]:
    slug, name = pair.split(':')
    req = urllib.request.Request(f"{URL}/rest/v1/scans?select=company_slug,company_name,domain,report_json&company_slug=eq.{slug}&status=eq.complete&limit=1", headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}'})
    row = json.load(urllib.request.urlopen(req))[0]
    raw = json.dumps(row, ensure_ascii=False)
    for u in sorted(set(IMG.findall(raw))):
        ext = (re.search(r'\.(png|jpe?g|webp|svg|gif)(?:\?|$)', u, re.I) or [None, 'png'])[1].lower()
        local = f"remote/{hashlib.sha1(u.encode()).hexdigest()[:12]}.{ext}"
        try:
            data = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'}), timeout=30).read()
            open(os.path.join(DIST, local), 'wb').write(data)
            raw = raw.replace(u, local)
            print(f"  {slug}: {u[-60:]} -> {local} ({len(data)//1024} KB)")
        except Exception as e:
            print(f"  {slug}: FAILED {u} {e}")
    inline = f'<script>window.__SCAN_ROW__ = {raw.replace("</", "<\\/")};</script>'
    html = tpl.replace('%SCAN_SLUG%', slug).replace('</head>', inline + '\n  </head>')
    open(os.path.join(DIST, f'{name}.html'), 'w').write(html)
    print(name, 'staged', len(html) // 1024, 'KB')
