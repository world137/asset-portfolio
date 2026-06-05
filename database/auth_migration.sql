-- auth_migration.sql
-- Run this in Supabase SQL Editor (once) to add username/password auth support.
--
-- After running, use tools/register-user.mjs to add or update users:
--   node tools/register-user.mjs <username> <password>

ALTER TABLE users ADD COLUMN IF NOT EXISTS username      TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Case-insensitive unique index on username
CREATE UNIQUE INDEX IF NOT EXISTS users_username_key
  ON users (lower(username))
  WHERE username IS NOT NULL;
