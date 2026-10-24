#!/usr/bin/env python3
"""Build the public static files only; never publish the project directory."""
import hashlib
import gzip
import io
import json
import subprocess
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = '''index.html favicon.svg style.css arena.css adventure.css app.js
adventure-ui.js engine.js levels.js challenges.js render.js combat.js gadgets.js
enemies.js shields.js avatars.js attack-input.js reset-input.js rewarded-ad.js
vendor/three.module.js vendor/three.core.js vendor/THREE-LICENSE.txt'''.split()


def build():
    files = []
    content = {}
    for name in sorted(FILES):
        path = ROOT / 'dist' / name
        if path.is_symlink() or not path.is_file():
            raise RuntimeError('Missing or unsafe public file: ' + name)
        data = path.read_bytes()
        content[name] = data
        files.append({'path': name, 'bytes': len(data),
                      'sha256': hashlib.sha256(data).hexdigest()})
    actual = {str(p.relative_to(ROOT / 'dist'))
              for p in (ROOT / 'dist').rglob('*') if p.is_file()}
    if actual != set(FILES):
        raise RuntimeError('dist differs from the reviewed public allowlist')
    html = content['index.html']
    for name in ('favicon.svg', 'style.css', 'arena.css', 'adventure.css', 'app.js'):
        if ('"./' + name + '"').encode() not in html:
            raise RuntimeError('Expected relative HTML asset: ' + name)
    manifest = {'format': 1, 'application': 'danzai', 'files': files,
                'sourceCommit': subprocess.check_output(
                    ['git', 'rev-parse', 'HEAD'], cwd=str(ROOT)).decode().strip(),
                'sourceDirty': bool(subprocess.check_output(
                    ['git', 'status', '--porcelain', '--untracked-files=no'],
                    cwd=str(ROOT)).strip())}
    encoded = (json.dumps(manifest, indent=2, sort_keys=True) + '\n').encode()
    release_id = hashlib.sha256(encoded).hexdigest()[:16]
    output = ROOT / 'artifacts'
    output.mkdir(exist_ok=True)
    package = output / ('danzai-aliyun-' + release_id + '.tar.gz')
    with package.open('wb') as output_file:
        with gzip.GzipFile(filename='', mode='wb', fileobj=output_file, mtime=0) as compressed:
            with tarfile.open(fileobj=compressed, mode='w') as archive:
                for name, data in [('manifest.json', encoded)] + [
                        ('site/' + name, content[name]) for name in sorted(FILES)]:
                    info = tarfile.TarInfo(name)
                    info.size = len(data)
                    info.mode = 0o644
                    info.mtime = 0
                    archive.addfile(info, io.BytesIO(data))
    # Verify the finished artifact independently of the writing loop.
    with tarfile.open(str(package), 'r:gz') as archive:
        if set(archive.getnames()) != {'manifest.json'} | {
                'site/' + name for name in FILES}:
            raise RuntimeError('Unexpected archive member')
        for entry in files:
            member = archive.getmember('site/' + entry['path'])
            data = archive.extractfile(member).read()
            if not member.isfile() or hashlib.sha256(data).hexdigest() != entry['sha256']:
                raise RuntimeError('Artifact verification failed: ' + entry['path'])
    checksum = hashlib.sha256(package.read_bytes()).hexdigest()
    package.with_suffix(package.suffix + '.sha256').write_text(
        checksum + '  ' + package.name + '\n')
    (output / 'danzai-manifest.json').write_bytes(encoded)
    print(json.dumps({'package': str(package), 'sha256': checksum,
                      'files': len(files), 'publicBytes': sum(f['bytes'] for f in files),
                      'packageBytes': package.stat().st_size}, indent=2))


if __name__ == '__main__':
    build()
