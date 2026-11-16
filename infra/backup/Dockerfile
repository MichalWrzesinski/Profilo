# Backup service for production (TASK-022): pg_dump from the same PostgreSQL release as the
# database, restic for encrypted, deduplicated off-site snapshots over SFTP, curl for alert
# e-mails. Published by CI as ghcr.io/michalwrzesinski/profilo-backup:<sha>.
FROM restic/restic:0.18.1@sha256:39d9072fb5651c80d75c7a811612eb60b4c06b32ffe87c2e9f3c7222e1797e76 AS restic

FROM postgres:18.6-alpine@sha256:123b17998ccaf47e53b502e8c6a1e79afd8f579c6f3eec83c563da026f957395
RUN apk add --no-cache curl openssh-client-default tzdata
COPY --from=restic /usr/bin/restic /usr/local/bin/restic
COPY profilo-backup /usr/local/bin/profilo-backup
RUN chmod 755 /usr/local/bin/profilo-backup
# The scheduler loop; `profilo-backup backup|restore-test|snapshots` run single jobs.
ENTRYPOINT ["/usr/local/bin/profilo-backup"]
CMD ["schedule"]
