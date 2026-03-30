-- Claude Code memory persistence for Railway container
-- Run this in Supabase SQL editor

CREATE TABLE IF NOT EXISTS claude_memory (
  id serial PRIMARY KEY,
  client_id text NOT NULL,
  file_path text NOT NULL UNIQUE,
  content text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claude_memory_client ON claude_memory(client_id);

-- Enable upsert on file_path conflict
ALTER TABLE claude_memory ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "service_role_all" ON claude_memory
  FOR ALL TO service_role USING (true) WITH CHECK (true);
