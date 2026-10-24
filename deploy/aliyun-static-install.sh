#!/usr/bin/env bash
# Deploy only the reviewed static package; do not change shared Caddy settings.
set -Eeuo pipefail
umask 077
BASE=/var/www/qdstorm
ENTRY="$BASE/danzai"
HOST=39.97.244.43
MODE=${1:-}
PACKAGE=${2:-}
DIGEST=${3:-}
[[ "$MODE" == --check || "$MODE" == --install ]] || {
  echo 'Usage: bash aliyun-static-install.sh --check|--install PACKAGE SHA256' >&2; exit 2;
}
[[ $(id -u) == 0 && -d "$BASE" && ! -L "$BASE" ]] || {
  echo 'Expected the confirmed root account and existing static root.' >&2; exit 1;
}
[[ "$DIGEST" =~ ^[0-9a-f]{64}$ && -f "$PACKAGE" && ! -L "$PACKAGE" ]] || exit 2
systemctl is-active --quiet caddy
exec 9>/run/lock/danzai-static-release.lock
flock -n 9 || { echo 'Another Danzai release is running.' >&2; exit 1; }
WORK=$(mktemp -d /var/tmp/danzai-deploy.XXXXXXXX)
printf '%s  %s\n' "$DIGEST" "$PACKAGE" | sha256sum -c -
caddy adapt --config /etc/caddy/Caddyfile --adapter caddyfile > "$WORK/caddy.json"
python3 - "$PACKAGE" "$WORK" "$HOST" "$BASE" <<'PY'
import hashlib, json, os, sys, tarfile
from pathlib import Path
archive, work, host, root = sys.argv[1:]
work = Path(work)
config = json.loads((work / 'caddy.json').read_text())
def walk(value):
    if isinstance(value, dict):
        yield value
        for item in value.values():
            yield from walk(item)
    elif isinstance(value, list):
        for item in value:
            yield from walk(item)
candidates = []
for server in config.get('apps', {}).get('http', {}).get('servers', {}).values():
    if not any(address.endswith(':80') for address in server.get('listen', [])):
        continue
    # Only top-level, host-only routes have no unknown ancestor restrictions.
    for route in server.get('routes', []):
        matches = route.get('match', [])
        if (len(matches) == 1 and set(matches[0]) == {'host'}
                and host in matches[0]['host']):
            candidates.append(route)
valid = False
for route in candidates:
    nodes = list(walk(route.get('handle', [])))
    roots = [node['root'] for node in nodes
             if node.get('handler') == 'vars' and 'root' in node]
    file_servers = [node for node in nodes if node.get('handler') == 'file_server']
    if (roots and all(value == root for value in roots) and file_servers
            and all(node.get('root', root) == root for node in file_servers)
            and not any(node.get('match') or 'path' in node
                        or node.get('handler', 'vars') not in
                        ('vars', 'subroute', 'file_server', 'headers', 'encode')
                        for node in nodes)):
        valid = True
if not valid:
    raise SystemExit('STOP: current IP host is not a confirmed unrestricted static root; review its routing first.')
allowed = set('''index.html favicon.svg style.css arena.css adventure.css app.js
adventure-ui.js engine.js levels.js challenges.js render.js combat.js gadgets.js
enemies.js shields.js avatars.js attack-input.js reset-input.js rewarded-ad.js
vendor/three.module.js vendor/three.core.js vendor/THREE-LICENSE.txt'''.split())
with tarfile.open(archive, 'r:gz') as bundle:
    members = bundle.getmembers()
    expected = {'manifest.json'} | {'site/' + name for name in allowed}
    if len(members) != len(expected) or {m.name for m in members} != expected:
        raise SystemExit('Unexpected or duplicate archive members')
    if any(not m.isfile() or m.size > 4000000 for m in members):
        raise SystemExit('Non-regular or oversized archive member')
    manifest = json.loads(bundle.extractfile('manifest.json').read().decode())
    entries = manifest['files']
    if len(entries) != len(allowed) or {f['path'] for f in entries} != allowed:
        raise SystemExit('Manifest differs from the reviewed public allowlist')
    for item in entries:
        name = item['path']
        data = bundle.extractfile('site/' + name).read()
        if len(data) != item['bytes'] or hashlib.sha256(data).hexdigest() != item['sha256']:
            raise SystemExit('Static checksum mismatch: ' + name)
        target = work / 'site' / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        os.chmod(str(target), 0o644)
    (work / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('VERIFIED_STATIC_FILES', len(entries))
PY
PREVIOUS=
if [[ -e "$ENTRY" || -L "$ENTRY" ]]; then
  [[ -L "$ENTRY" ]] || { echo 'STOP: destination is an existing non-release object.' >&2; exit 1; }
  PREVIOUS=$(readlink -f "$ENTRY")
  [[ -d "$PREVIOUS" && "$PREVIOUS" == "$BASE"/.danzai-release.* ]] || exit 1
fi
if [[ "$MODE" == --check ]]; then
  printf 'CHECK_OK\nRECORDS=%s\nPREVIOUS=%s\n' "$WORK" "$PREVIOUS"
  exit 0
fi
RELEASE=$(mktemp -d "$BASE/.danzai-release.XXXXXXXX")
cp -a "$WORK/site/." "$RELEASE/"
find "$RELEASE" -type d -exec chmod 0755 {} +
find "$RELEASE" -type f -exec chmod 0644 {} +
CURRENT=
if [[ -e "$ENTRY" || -L "$ENTRY" ]]; then
  [[ -L "$ENTRY" ]] || { echo 'Destination is no longer a release link.' >&2; exit 1; }
  CURRENT=$(readlink -f "$ENTRY")
fi
[[ "$CURRENT" == "$PREVIOUS" ]] || { echo 'Destination changed during preparation.' >&2; exit 1; }
TEMP="$BASE/.danzai-link.$$"
ln -sT "$RELEASE" "$TEMP"
SWITCHED=0
rollback() {
  local status=$?
  trap - EXIT
  if (( status != 0 && SWITCHED )); then
    if [[ $(readlink -f "$ENTRY") == "$RELEASE" ]]; then
      if [[ -n "$PREVIOUS" ]]; then
        ln -sT "$PREVIOUS" "$BASE/.danzai-rollback.$$"
        mv -Tf "$BASE/.danzai-rollback.$$" "$ENTRY"
      else
        unlink "$ENTRY"
      fi
      echo 'Restored the previous Danzai entry; release files retained for review.' >&2
    fi
  fi
  exit "$status"
}
trap rollback EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# Arm before mv: a signal immediately after the atomic replacement must roll back.
SWITCHED=1
mv -Tf "$TEMP" "$ENTRY"
python3 - "$WORK/manifest.json" "$HOST" <<'PY'
import hashlib, json, sys, urllib.request
manifest = json.load(open(sys.argv[1]))
for item in manifest['files']:
    request = urllib.request.Request('http://127.0.0.1/danzai/' + item['path'],
                                     headers={'Host': sys.argv[2], 'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(request, timeout=15) as response:
        data = response.read()
        if response.status != 200 or hashlib.sha256(data).hexdigest() != item['sha256']:
            raise SystemExit('Served checksum mismatch: ' + item['path'])
print('VERIFIED_HTTP_FILES', len(manifest['files']))
PY
systemctl is-active --quiet caddy
printf 'DANZAI_LIVE http://%s/danzai/\nRELEASE=%s\nPREVIOUS=%s\nRECORDS=%s\n' "$HOST" "$RELEASE" "$PREVIOUS" "$WORK"
SWITCHED=0
