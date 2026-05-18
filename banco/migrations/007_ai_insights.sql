-- Migration 007: AI Insights cache table
-- Stores Groq-generated insights per company, cached for 6 hours

CREATE TABLE IF NOT EXISTS ai_insights (
  id           SERIAL PRIMARY KEY,
  company_id   INT NOT NULL,
  insights     JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at   TIMESTAMPTZ DEFAULT NOW() + INTERVAL '6 hours'
);

CREATE INDEX IF NOT EXISTS ai_insights_company_expires
  ON ai_insights (company_id, expires_at);
