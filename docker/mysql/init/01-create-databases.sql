-- Runs once, only when the mysql container's data volume is first
-- initialized (docker-entrypoint-initdb.d convention). Creates the two
-- application databases; each backend's own migrate/seed step fills them in.
CREATE DATABASE IF NOT EXISTS `master_hub` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS `jayhind_client` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
