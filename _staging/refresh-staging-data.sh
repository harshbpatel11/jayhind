#!/usr/bin/env bash
# MASTER_DEVELOPMENT_PLAN.md O1.3 — refresh the staging databases from a
# scrubbed copy of dev.
#
#   bash _staging/refresh-staging-data.sh
#
# Dumps jayhind_client + master_hub, scrubs every email/phone column to a
# safe, non-deliverable value (preserving uniqueness so unique indexes still
# import cleanly), and loads the result into jayhind_client_staging /
# master_hub_staging. Idempotent — safe to re-run any time dev data changes
# and you want staging to reflect it again.
#
# This box's own dev data is already fake/seeded (CLAUDE.md §1: "nothing is
# deployed anywhere ... no real customer, no real data") but a scrub step is
# rehearsed for real here anyway — it already caught one live gmail.com
# address in the seeded QA fixtures, which is exactly the class of thing this
# guards against becoming a real outbound-mail accident once O1.5 wires up
# SMTP against this same box.
set -euo pipefail
cd "$(dirname "$0")"

MYSQL_USER=root
MYSQL_PASS=root
DUMP_DIR="$(mktemp -d)"
trap 'rm -rf "$DUMP_DIR"' EXIT

mysql() { command mysql -u "$MYSQL_USER" -p"$MYSQL_PASS" "$@" 2>/dev/null; }
mysqldump() { command mysqldump -u "$MYSQL_USER" -p"$MYSQL_PASS" "$@" 2>/dev/null; }

echo "==> Dumping jayhind_client and master_hub"
mysqldump --routines --triggers jayhind_client > "$DUMP_DIR/client.sql"
mysqldump --routines --triggers master_hub > "$DUMP_DIR/hub.sql"

echo "==> Loading into staging databases"
mysql jayhind_client_staging < "$DUMP_DIR/client.sql"
mysql master_hub_staging < "$DUMP_DIR/hub.sql"

echo "==> Scrubbing PII in staging (deterministic per-row rewrite, uniqueness preserved)"
mysql jayhind_client_staging <<'SQL'
UPDATE users SET email = CONCAT('user-', id, '@staging.invalid') WHERE email IS NOT NULL AND email != '';
UPDATE users SET phone = CASE WHEN phone IS NOT NULL AND phone != '' THEN CONCAT('9', LPAD(id, 9, '0')) ELSE phone END;
UPDATE employees SET personalEmail = CASE WHEN personalEmail IS NOT NULL AND personalEmail != '' THEN CONCAT('employee-', id, '@staging.invalid') ELSE personalEmail END;
UPDATE employees SET personalPhone = CASE WHEN personalPhone IS NOT NULL AND personalPhone != '' THEN CONCAT('9', LPAD(id, 9, '0')) ELSE personalPhone END;
UPDATE employee_contacts SET phone = CASE WHEN phone IS NOT NULL AND phone != '' THEN CONCAT('9', LPAD(id, 9, '0')) ELSE phone END;
UPDATE employee_contacts SET altPhone = NULL WHERE altPhone IS NOT NULL;
UPDATE manufactures SET email = CASE WHEN email IS NOT NULL AND email != '' THEN CONCAT('manufacturer-', id, '@staging.invalid') ELSE email END;
UPDATE manufactures SET phone = CASE WHEN phone IS NOT NULL AND phone != '' THEN CONCAT('9', LPAD(id, 9, '0')) ELSE phone END;
UPDATE site_configurations SET email = CASE WHEN email IS NOT NULL AND email != '' THEN CONCAT('company-', id, '@staging.invalid') ELSE email END;
UPDATE site_configurations SET phone = CASE WHEN phone IS NOT NULL AND phone != '' THEN CONCAT('9', LPAD(id, 9, '0')) ELSE phone END;
SQL

mysql master_hub_staging <<'SQL'
UPDATE users SET email = CONCAT('hubuser-', id, '@staging.invalid') WHERE email IS NOT NULL AND email != '';
UPDATE tenants SET contactEmail = CASE WHEN contactEmail IS NOT NULL AND contactEmail != '' THEN CONCAT('tenant-', id, '@staging.invalid') ELSE contactEmail END;
UPDATE integration_configurations SET email = CASE WHEN email IS NOT NULL AND email != '' THEN CONCAT('integration-', id, '@staging.invalid') ELSE email END;
SQL

echo "==> Done. Staging DBs now hold a scrubbed copy of dev."
echo "    jayhind_client_staging: $(mysql -N -e 'SELECT COUNT(*) FROM jayhind_client_staging.users') users"
echo "    master_hub_staging:     $(mysql -N -e 'SELECT COUNT(*) FROM master_hub_staging.users') users"
