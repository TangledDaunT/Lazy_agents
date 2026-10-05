---
name: immich-hp-laptop
description: Operate, repair, and maintain the Dockerized Immich deployment on the HP Linux laptop, including persistent NAS mounting, Samba, external libraries, authentication, and recovery.
---

# HP laptop Immich operations

Use this skill whenever the HP laptop Immich instance is unavailable, the external media is missing, the NAS mount is broken, the Docker stack fails, Samba stops working, an external library needs to be rescanned, or the Immich account needs maintenance.

## Safety and secrets

- Never commit, print, paste into chat, or store passwords, Immich API keys, database passwords, or session tokens in this skill.
- Obtain the SSH password, Immich account password, and API key from the Hermes secret store or an interactive prompt. Prefer an SSH key over `sshpass`.
- Do not delete `/mnt/nas/immich/postgres`, `/home/shreyansh/immich/postgres`, `/mnt/nas/immich/library`, or any media directory.
- Before changing `/etc/fstab`, `.env`, or Compose files, create a timestamped backup.
- Do not run `docker-compose down -v`, `docker volume prune`, database initialization, or destructive SQL.
- Preserve the existing database. The database currently uses the PostgreSQL role `immich`; do not assume the role is named `postgres`.

## Known topology

- Linux user: `shreyansh`
- Host is reachable through Tailscale; discover its address dynamically:

  ```bash
  tailscale status
  ```

- Immich project: `/home/shreyansh/immich`
- Compose file: `/home/shreyansh/immich/docker-compose.yml`
- Environment file: `/home/shreyansh/immich/.env`
- External disk mount: `/mnt/nas`
- External disk filesystem: exFAT, UUID `6EFF-790D`, label `MyNAS`
- `/home/shreyansh/NAS` is a compatibility symlink to `/mnt/nas`
- Immich server port: `2283`
- Docker containers: `immich_server`, `immich_postgres`, `immich_machine_learning`, `immich_redis`
- Requested source folders:
  - `/mnt/nas/Photos`
  - `/mnt/nas/HP-Laptop-Desktop`
  - `/mnt/nas/immich/library` (the deployed `image` source)

The host may have a different Tailscale IP after network changes. Never hard-code an old IP when `tailscale status` can provide the current one.

## SSH procedure

From the operator machine, use an SSH key if available:

```bash
ssh shreyansh@<TAILSCALE_IP>
```

If password authentication is unavoidable, obtain the password securely and do not put it in shell history:

```bash
read -rsp 'SSH password: ' SSHPASS; export SSHPASS; echo
sshpass -e ssh -o ConnectTimeout=20 shreyansh@<TAILSCALE_IP>
unset SSHPASS
```

Confirm the host before making changes:

```bash
hostname
id
findmnt /mnt/nas
systemctl is-active docker
```

## First-response diagnostics

Run these read-only checks first:

```bash
cd /home/shreyansh/immich
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
docker-compose version
docker-compose config >/tmp/immich-compose-config.txt
curl -i --max-time 20 http://127.0.0.1:2283/api/server/ping
findmnt /mnt/nas
findmnt --verify --verbose
systemctl is-enabled docker smbd 2>/dev/null || true
systemctl is-active docker smbd 2>/dev/null || true
```

Inspect only non-secret configuration:

```bash
grep -E '^(UPLOAD_LOCATION|DB_DATA_LOCATION|IMMICH_VERSION|DB_USERNAME|DB_DATABASE_NAME)=' /home/shreyansh/immich/.env
grep -vE '^(DB_PASSWORD|.*KEY.*|.*SECRET.*)=' /home/shreyansh/immich/.env
grep -nE '^(\[|[[:space:]]*path[[:space:]]*=|[[:space:]]*read only|[[:space:]]*valid users)' /etc/samba/smb.conf
```

Check source directories without recursively dumping filenames:

```bash
for p in /mnt/nas/Photos /mnt/nas/HP-Laptop-Desktop /mnt/nas/immich/library; do
  printf '%s: ' "$p"
  find "$p" -type f -print -quit 2>/dev/null
done
```

## Persistent NAS mount repair

Back up the mount table and inspect the current device:

```bash
sudo cp -a /etc/fstab "/etc/fstab.before-immich-$(date +%Y%m%d-%H%M%S)"
lsblk -f
blkid /dev/sdb1
```

There must be one authoritative entry for `/mnt/nas`. Remove or comment conflicting entries targeting `/mnt/nas` or `/home/shreyansh/NAS`, while preserving unrelated mounts. The intended entry is:

```text
UUID=6EFF-790D /mnt/nas exfat defaults,uid=1000,gid=1000,umask=022,nofail,x-systemd.device-timeout=30 0 0
```

After editing:

```bash
sudo systemctl daemon-reload
sudo mount -a
findmnt /mnt/nas
findmnt --verify --verbose
```

Do not reboot merely to test. If a reboot is explicitly requested, verify afterward:

```bash
findmnt /mnt/nas
test -d /mnt/nas/Photos
systemctl is-active docker smbd
```

## Compose and environment requirements

The deployment must retain these effective settings:

```text
UPLOAD_LOCATION=/mnt/nas/immich/library
DB_DATA_LOCATION=/home/shreyansh/immich/postgres
DB_USERNAME=immich
```

The database remains on the local Linux filesystem; do not move PostgreSQL data onto the exFAT/NAS disk.

Back up before editing:

```bash
cp -a /home/shreyansh/immich/.env "/home/shreyansh/immich/.env.before-immich-$(date +%Y%m%d-%H%M%S)"
cp -a /home/shreyansh/immich/docker-compose.yml "/home/shreyansh/immich/docker-compose.yml.before-immich-$(date +%Y%m%d-%H%M%S)"
```

The `immich-server` service must retain:

```yaml
restart: always
volumes:
  - ${UPLOAD_LOCATION}:/data
  - /mnt/nas/Photos:/external/photos:ro
  - /mnt/nas/HP-Laptop-Desktop:/external/hp-laptop-desktop:ro
  - /mnt/nas/immich/library:/external/image:ro
```

Validate and start without deleting volumes:

```bash
cd /home/shreyansh/immich
docker-compose config >/tmp/immich-compose-config.txt
docker-compose up -d
docker ps
curl -fsS http://127.0.0.1:2283/api/server/ping
```

If legacy `docker-compose` fails with `KeyError: 'ContainerConfig'`, remove only stale Compose-managed containers and recreate them. Do not remove images or data:

```bash
cd /home/shreyansh/immich
ids="$(docker ps -aq --filter label=com.docker.compose.project=immich)"
if [ -n "$ids" ]; then docker rm -f $ids; fi
docker-compose up -d
```

## Storage marker repair

Immich requires marker files under the upload location. If logs report a missing `.immich` marker, create only the required directories and markers:

```bash
sudo bash -c '
base=/mnt/nas/immich/library
for d in thumbs upload backups library profile encoded-video; do
  mkdir -p "$base/$d"
  printf "immich" > "$base/$d/.immich"
done
'
cd /home/shreyansh/immich
docker-compose restart immich-server
curl -fsS http://127.0.0.1:2283/api/server/ping
```

## External libraries

The three external libraries are:

| Library name | Container path | Host path |
|---|---|---|
| Photos | `/external/photos` | `/mnt/nas/Photos` |
| HP laptop desktop | `/external/hp-laptop-desktop` | `/mnt/nas/HP-Laptop-Desktop` |
| image | `/external/image` | `/mnt/nas/immich/library` |

Use the authenticated Immich API or the web UI to create/scan libraries. Do not create duplicate libraries if they already exist. The API flow is:

```bash
BASE=http://127.0.0.1:2283
TOKEN='<obtain securely; do not save in this skill>'
curl -fsS -H "Authorization: Bearer $TOKEN" "$BASE/api/libraries"
```

For each library ID, start a scan:

```bash
curl -i -X POST \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/libraries/<LIBRARY_ID>/scan"
```

Scans are asynchronous. Follow progress:

```bash
docker logs --since 5m immich_server 2>&1 |
  grep -E 'Starting to scan|Crawled|Imported|Finished disk crawl|ERROR' |
  tail -n 80
```

Do not interpret an immediate `assetCount: 0` as failure while a crawl is running. Verify the container can read each path:

```bash
for p in /external/photos /external/hp-laptop-desktop /external/image; do
  docker exec immich_server sh -c "test -d '$p' && test -r '$p'"
done
```

## Account maintenance

The existing administrator email is `shreyanshmishra2810@gmail.com`. Never print or store its password in this file.

Verify login using a password supplied securely at runtime:

```bash
read -rsp 'Immich password: ' IMMICH_PASS; echo
curl -sS -o /tmp/immich-login.json -w '%{http_code}\n' \
  -X POST http://127.0.0.1:2283/api/auth/login \
  -H 'Content-Type: application/json' \
  --data "{\"email\":\"shreyanshmishra2810@gmail.com\",\"password\":\"$IMMICH_PASS\"}"
unset IMMICH_PASS
```

HTTP `201` with an access token indicates successful authentication.

If an administrator password must be reset and the supported admin flow is unavailable, use a locally generated bcrypt hash. Never put the password in command history or the skill file:

```bash
read -rsp 'New Immich password: ' NEWPASS; echo
HASH="$(NEWPASS="$NEWPASS" python3 -c 'import os,bcrypt; print(bcrypt.hashpw(os.environ["NEWPASS"].encode(), bcrypt.gensalt()).decode())')"
docker exec -u postgres immich_postgres psql -U immich -d immich \
  -c "UPDATE \"user\" SET password = '$HASH', \"shouldChangePassword\" = false, \"updatedAt\" = now() WHERE email = 'shreyanshmishra2810@gmail.com';"
unset NEWPASS HASH
```

Before using this SQL, confirm the existing role and schema:

```bash
docker exec -u postgres immich_postgres psql -U immich -d immich \
  -c 'select current_user;'
```

## Samba

The Samba share is expected to point through `/home/shreyansh/NAS` to `/mnt/nas`:

```text
[nas]
   path = /home/shreyansh/NAS
   read only = no
   valid users = shreyansh
```

Validate and restart only if needed:

```bash
testparm -s
systemctl is-enabled smbd
systemctl is-active smbd
sudo systemctl restart smbd
```

Do not change Samba permissions or expose the share publicly without explicit authorization.

## Final acceptance checklist

```bash
systemctl is-enabled docker smbd
systemctl is-active docker smbd
findmnt /mnt/nas
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
docker inspect immich_server --format '{{.HostConfig.RestartPolicy.Name}}'
curl -fsS http://127.0.0.1:2283/api/server/ping
```

Also confirm:

1. `/mnt/nas` is mounted from the expected exFAT UUID.
2. `immich_server` has all three `/external/*` read-only mounts.
3. The external library scans finish without path or permission errors.
4. Login succeeds using the password supplied at runtime.
5. No destructive Docker or database operation was used.

