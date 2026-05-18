-- Migration 008: Push notification tokens
-- Stores Expo push tokens per user/device

CREATE TABLE IF NOT EXISTS push_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INT REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  platform   VARCHAR(10),  -- 'ios' | 'android'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS push_tokens_user_id ON push_tokens (user_id);
