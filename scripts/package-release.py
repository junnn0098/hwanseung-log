"""Create a source release using an explicit allowlist; never package credentials."""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent.parent
files = [root / name for name in [
    'package.json', 'package-lock.json', 'server.mjs', 'integrations.mjs', 'tourism.mjs', 'request-guard.mjs',
    'wrangler.jsonc', '.dev.vars.example', 'DEPLOYMENT-VPS.md',
    'Dockerfile', '.dockerignore', 'compose.yaml', 'Caddyfile', '.env.example',
    '.gitignore', 'README.md', 'FEATURES.md', 'EVALUATION.md', 'DEPLOYMENT.md', '실행하기.cmd',
]]
for folder in ['public', 'scripts', 'tests', 'cloudflare']:
    files.extend(p for p in (root / folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
secrets = []
for env in [root / '.env', root / '.dev.vars']:
    if not env.exists():
        continue
    for line in env.read_text(encoding='utf-8-sig').splitlines():
        key, sep, value = line.partition('=')
        if sep and key.strip().endswith('_KEY') and len(value.strip()) > 8:
            secrets.append(value.strip().strip('\"\'').encode())
for p in files:
    if p.is_symlink() or not p.resolve().is_relative_to(root) or p.name in ['.env', '.dev.vars']:
        raise SystemExit('Unsafe release path')
    content = p.read_bytes()
    if any(secret in content for secret in secrets):
        raise SystemExit('Credential found: release cancelled')
out = root.parent / 'hwanseung-log-cloudflare.zip'
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as archive:
    for p in sorted(files):
        archive.write(p, p.relative_to(root).as_posix())
print(f'Release ready: {out.name} ({len(files)} files; credentials excluded)')
