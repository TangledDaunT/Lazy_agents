# Codex handoff: home media and Immich stack

## Objective

Continue repairing and operating the home media stack on the HP Linux laptop:

- Mount the external 1 TB exFAT drive reliably at `/mnt/nas`.
- Keep Immich pointed at that drive and make its external libraries available.
- Keep Jellyseerr, Jellyfin, Radarr, Sonarr, and qBittorrent running persistently.
- Preserve all existing media, downloads, databases, and configuration.
- Finish and verify the request-to-download workflow through Jellyseerr → Radarr/Sonarr → qBittorrent → Jellyfin.

## Remote host

- Tailscale host/IP used previously: `100.99.161.57`
- Linux user: `shreyansh`
- Hostname: `shreyansh-HP-Laptop-15-da0xxx`
- Docker service is enabled and active.
- SSH/sudo credentials were supplied in chat but are intentionally **not recorded here**. Obtain them securely at runtime.

## Important security rules

- Never print, commit, or store passwords, API keys, database passwords, or session tokens.
- Do not use `docker compose down -v`, Docker volume pruning, database initialization, destructive SQL, or media deletion.
- Do not run filesystem repair that modifies the disk without first confirming the device is present and obtaining user approval if repair is needed.
- Before changing `/etc/fstab`, `.env`, or Compose files, create a timestamped backup.
- Preserve the existing Immich PostgreSQL database and all media/download directories.

## Services and URLs

When the host is reachable, these are the intended ports:

| Service | URL |
|---|---|
| Immich | `http://100.99.161.57:2283` |
| Jellyseerr | `http://100.99.161.57:5055` |
| Jellyfin | `http://100.99.161.57:8096/web` |
| Radarr | `http://100.99.161.57:7878` |
| Sonarr | `http://100.99.161.57:8989` |
| qBittorrent | `http://100.99.161.57:8081` |

## Current Docker containers

Expected container names:

- `immich_server`
- `immich_postgres`
- `immich_machine_learning`
- `immich_redis`
- `jellyseerr`
- `jellyfin`
- `radarr`
- `sonarr`
- `qbittorrent`

The media containers were changed to Docker restart policy `always` and verified previously:

- `jellyseerr`
- `jellyfin`
- `radarr`
- `sonarr`
- `qbittorrent`

Immich containers already used `always`.

Verify with:

```bash
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
for n in immich_server immich_postgres immich_machine_learning immich_redis jellyseerr jellyfin radarr sonarr qbittorrent; do
  docker inspect -f "$n restart={{.HostConfig.RestartPolicy.Name}}" "$n"
done
systemctl is-enabled docker
systemctl is-active docker
```

## External disk and mount

Expected disk:

- Device previously detected as `/dev/sdb1`
- Filesystem: exFAT
- UUID: `6EFF-790D`
- Label: `MyNAS`
- Expected mount: `/mnt/nas`
- Compatibility symlink: `/home/shreyansh/NAS -> /mnt/nas`

Expected persistent fstab entry:

```text
UUID=6EFF-790D /mnt/nas exfat defaults,uid=1000,gid=1000,umask=000,nofail,x-systemd.device-timeout=30 0 0
```

The entry was restored and backed up previously. Do not add duplicate entries.

First diagnose the physical connection:

```bash
lsusb
lsblk -o NAME,PATH,MODEL,SERIAL,FSTYPE,LABEL,UUID,SIZE,MOUNTPOINTS
ls -l /dev/disk/by-uuid
readlink -f /dev/disk/by-uuid/6EFF-790D
journalctl -k --since '15 minutes ago' --no-pager | \
  grep -Ei 'usb|sdb|scsi|exfat|disconnect|enumerat|I/O error'
findmnt /mnt/nas
```

Previous latest diagnosis:

- `lsusb` did not show the external disk.
- `/dev/sdb1` and `/dev/disk/by-uuid/6EFF-790D` were absent.
- Kernel logs repeatedly showed:
  - USB descriptor read timeouts (`error -110`)
  - USB power-cycle attempts
  - inability to enumerate the device
  - I/O errors and device-offline errors on `sdb`
- A stale `/mnt/nas` mount reference remained visible even though its device node was gone.
- This strongly indicates a USB cable, USB port, power, enclosure, or disk hardware/connection issue, not a Docker configuration issue.

Once the disk is genuinely detected:

```bash
test -b /dev/sdb1
blkid /dev/sdb1
sudo mount /mnt/nas
findmnt /mnt/nas
for p in /mnt/nas/Photos /mnt/nas/HP-Laptop-Desktop /mnt/nas/immich/library; do
  stat "$p"
done
```

If the drive is detected but the mount is stale, unmount only the specific `/mnt/nas` mount and remount it. Do not force-unmount while active services are using it unless necessary and safe.

Do not run `fsck.exfat` in repair mode automatically. A read-only check may be considered only after the block device is present and the user has been informed.

## Immich project

Project directory:

```text
/home/shreyansh/immich
```

Environment requirements:

```text
UPLOAD_LOCATION=/mnt/nas/immich/library
DB_DATA_LOCATION=/home/shreyansh/immich/postgres
DB_USERNAME=immich
IMMICH_VERSION=v3
```

Required `immich-server` mounts:

```yaml
volumes:
  - ${UPLOAD_LOCATION}:/data
  - /etc/localtime:/etc/localtime:ro
  - /mnt/nas/Photos:/external/photos:ro
  - /mnt/nas/HP-Laptop-Desktop:/external/hp-laptop-desktop:ro
  - /mnt/nas/immich/library:/external/image:ro
```

Do not move PostgreSQL data to exFAT.

Immich libraries previously configured:

| Library | Host path | Container path |
|---|---|---|
| Photos | `/mnt/nas/Photos` | `/external/photos` |
| HP laptop desktop | `/mnt/nas/HP-Laptop-Desktop` | `/external/hp-laptop-desktop` |
| image | `/mnt/nas/immich/library` | `/external/image` |

Previously observed asset counts were approximately:

- Photos: 9,063
- HP-Laptop-Desktop: 42,049
- image: 9,063

Immich account:

- Email was changed to `shreyanshmishra2810@gmail.com`.
- Password was reset and login was previously verified.
- The password is intentionally not recorded here.

Current Immich failure:

`immich_server` starts but fails its storage integrity check because reading `/data/encoded-video/.immich` returns `EIO`. This is caused by the failing/missing external disk. Do not recreate or overwrite media directories until the disk is confirmed healthy.

After the disk is mounted and readable:

```bash
cd /home/shreyansh/immich
docker compose config
docker compose up -d
curl -i --max-time 20 http://127.0.0.1:2283/api/server/ping
docker inspect immich_server --format '{{.State.Health.Status}}'
docker exec immich_server sh -c 'for p in /external/photos /external/hp-laptop-desktop /external/image; do test -d "$p" && test -r "$p"; done'
```

Only if the directories exist and are readable but marker files are genuinely missing, create the standard marker files exactly as documented in the Immich operations runbook. Do not do this while the disk is returning I/O errors.

## Media stack project

Project directory:

```text
/home/shreyansh/docker/media-stack
```

Compose file:

```text
/home/shreyansh/docker/media-stack/docker-compose.yml
```

A timestamped backup was created before changing restart policies. Validate:

```bash
cd /home/shreyansh/docker/media-stack
docker compose config
```

Shared media paths:

- Host media root: `/home/shreyansh/media-data`
- Container media root: `/data`
- qBittorrent downloads: `/data/downloads/qbittorrent`
- Radarr root: `/data/media/movies`
- Sonarr root: `/data/media/tv`
- Jellyfin sees the shared `/data` tree.

Internal service addresses:

- qBittorrent: `qbittorrent:8080`
- Radarr: `radarr:7878`
- Sonarr: `sonarr:8989`
- Jellyfin: `jellyfin:8096`

Jellyseerr:

- Port: `5055`
- Uses a custom local image `jellyseerr-authfix:local`.
- Dockerfile: `/home/shreyansh/docker/media-stack/jellyseerr/Dockerfile`
- The image patches Jellyfin authorization compatibility.
- Jellyseerr is configured with Jellyfin libraries Movies, Shows, and TV.
- Radarr and Sonarr are configured as default services.
- Radarr root: `/data/media/movies`.
- Sonarr root: `/data/media/tv`.
- HD `720p/1080p` quality profile was selected.
- Jellyseerr’s API status previously returned version `2.7.3`.

## qBittorrent authentication

Web UI:

```text
http://100.99.161.57:8081
```

The requested username is `Shreyansh`. The password is intentionally not recorded here; obtain it securely from the user/secret store.

The last verified direct login returned HTTP `204`:

```bash
curl -sS -c /tmp/q.cookies \
  -d 'username=<secure username>&password=<secure password>' \
  -o /dev/null -w '%{http_code}\n' \
  http://127.0.0.1:8081/api/v2/auth/login
```

qBittorrent previously banned the Radarr container IP after repeated attempts with the old `admin` username. Restarting only qBittorrent cleared the temporary ban. The qBittorrent config has host-header validation disabled and WebUI bound to all addresses.

If unauthorized returns again:

1. Verify the user is using port `8081`.
2. Use the configured username, not `admin`.
3. Test login directly with a securely supplied password.
4. Check `docker logs qbittorrent`.
5. Avoid repeated incorrect attempts that trigger the IP ban.

## Radarr and Sonarr authentication

API keys are stored in:

```text
/home/shreyansh/docker/media-stack/radarr/config/config.xml
/home/shreyansh/docker/media-stack/sonarr/config/config.xml
```

Never print the keys.

Both download clients were updated to use the qBittorrent credentials. Final tests previously returned:

- Radarr download-client test: HTTP 200
- Sonarr download-client test: HTTP 200
- Radarr API system status: HTTP 200
- Sonarr API system status: HTTP 200

Radarr had zero configured indexers at the last check. Sonarr had two existing indexer entries, but their usability should be verified. Without an authorized working indexer, Jellyseerr requests cannot actually find and download new media.

Check without exposing credentials:

```bash
R=$(sed -n 's:.*<ApiKey>\(.*\)</ApiKey>.*:\1:p' \
  /home/shreyansh/docker/media-stack/radarr/config/config.xml)
S=$(sed -n 's:.*<ApiKey>\(.*\)</ApiKey>.*:\1:p' \
  /home/shreyansh/docker/media-stack/sonarr/config/config.xml)
curl -fsS -H "X-Api-Key: $R" http://127.0.0.1:7878/api/v3/indexer | jq length
curl -fsS -H "X-Api-Key: $S" http://127.0.0.1:8989/api/v3/indexer | jq length
```

Do not add an unknown or unauthorized indexer automatically. Ask the user for an authorized indexer configuration if actual searching/downloading is required.

## End-to-end acceptance checks

After restoring the disk:

```bash
for p in 2283 5055 8096 7878 8989 8081; do
  curl -sS -o /dev/null -w "$p:%{http_code}\n" --max-time 10 "http://127.0.0.1:$p/" || true
done

docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

Expected basic HTTP responses:

- Immich `/api/server/ping`: successful response after health becomes healthy
- Jellyseerr `/`: `307`
- Jellyfin `/`: `302`
- Radarr `/`: normally `200` or `302`
- Sonarr `/`: normally `200` or `302`
- qBittorrent `/`: `200`

Verify container networking:

```bash
docker exec radarr sh -c \
  'curl -sS -c /tmp/qc -d "username=<secure>&password=<secure>" \
   -o /tmp/ql -w "%{http_code}\n" http://qbittorrent:8080/api/v2/auth/login'
```

A successful qBittorrent login is HTTP `204`.

## Important functional limitation

Jellyfin itself does not natively make a movie/show click initiate a download. The supported flow is:

1. Search/request in Jellyseerr.
2. Jellyseerr sends the request to Radarr or Sonarr.
3. Radarr/Sonarr search configured indexers.
4. Radarr/Sonarr send the release to qBittorrent.
5. qBittorrent downloads to the shared `/data` tree.
6. Radarr/Sonarr import into `/data/media/movies` or `/data/media/tv`.
7. Jellyfin scans the library and makes it playable.

“Instantly” depends on a working authorized indexer, an available release, download speed, import completion, and Jellyfin scan timing. Do not claim instant playback unless a real request has been tested end to end.

## Recommended next actions for Codex

1. Recheck USB detection and kernel logs.
2. If the disk is not detected, stop and report the physical USB problem; do not fabricate a mount.
3. If detected, verify UUID `6EFF-790D`, mount `/mnt/nas`, and test reads from all three source directories.
4. Back up and validate `/etc/fstab`; keep exactly one authoritative `/mnt/nas` entry.
5. Restart Immich only after the disk is readable; wait for healthy status and verify `/api/server/ping`.
6. Confirm the Immich external mounts and library accessibility.
7. Confirm all media containers have `restart: always`, stable ports, and healthy HTTP endpoints.
8. Re-test qBittorrent credentials and Radarr/Sonarr download-client tests without exposing secrets.
9. Check indexer readiness. If Radarr has no authorized indexer, clearly report that as the remaining blocker rather than adding an unknown source.
10. Preserve all backups, media, downloads, databases, and existing service configuration.
