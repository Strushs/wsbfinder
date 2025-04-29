-- chat_messages table
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for faster room lookups
CREATE INDEX idx_chat_messages_room_id_created_at ON public.chat_messages (room_id, created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Allow users to insert messages into rooms they are part of
CREATE POLICY "Allow insert for room participants" ON public.chat_messages
FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND
  -- Check if the user's ID is part of the room_id string 'user1--user2'
  room_id LIKE '%' || auth.uid()::text || '%'
);

-- Policy: Allow users to select messages from rooms they are part of
CREATE POLICY "Allow select for room participants" ON public.chat_messages
FOR SELECT USING (
  -- Check if the user's ID is part of the room_id string 'user1--user2'
  room_id LIKE '%' || auth.uid()::text || '%'
);

-- Optional: Allow users to delete their own messages (if needed)
-- CREATE POLICY "Allow delete for message owner" ON public.chat_messages
-- FOR DELETE USING (
--   auth.uid() = sender_id
-- );

-- Grant usage permissions to authenticated users
GRANT SELECT, INSERT, DELETE ON TABLE public.chat_messages TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE chat_messages_id_seq TO authenticated; -- If using SERIAL id instead of UUID

-- Make sure realtime is enabled for the table if you want to subscribe later
-- (You might need to do this in the Supabase UI under Database -> Replication)
-- alter publication supabase_realtime add table public.chat_messages;