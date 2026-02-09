-- Journal Entry Review Comments Migration
-- Adds review_comments column for approval workflow with comments
-- Run this in Supabase SQL Editor

-- Add review_comments JSONB column to journal_entries table
ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS review_comments JSONB DEFAULT '[]'::JSONB;

-- Add updated_by and updated_at columns for tracking edits
ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS updated_by TEXT;

ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Update status CHECK constraint to include REVISION_REQUESTED
-- First, drop the existing constraint
ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_status_check;

-- Recreate the constraint with the new status value
ALTER TABLE journal_entries 
ADD CONSTRAINT journal_entries_status_check 
CHECK (status IN ('DRAFT', 'POSTED', 'REVERSED', 'REVISION_REQUESTED'));

-- Add a comment explaining the review_comments structure
COMMENT ON COLUMN journal_entries.review_comments IS 
    'JSON array of review comments: [{id, userId, userName, comment, action: "COMMENT"|"REQUEST_REVISION"|"APPROVED"|"REJECTED", createdAt}]';

-- Create index for faster lookups on status
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(status);

-- Example of a review comment structure:
/*
[
  {
    "id": "rc-1707500000000",
    "userId": "user-uuid",
    "userName": "John Accountant",
    "comment": "Please correct the invoice amount",
    "action": "REQUEST_REVISION",
    "createdAt": "2026-02-09T10:00:00.000Z"
  },
  {
    "id": "rc-1707500100000",
    "userId": "user-uuid-2",
    "userName": "Jane AR",
    "comment": "Corrected as requested",
    "action": "COMMENT",
    "createdAt": "2026-02-09T11:00:00.000Z"
  },
  {
    "id": "rc-1707500200000",
    "userId": "user-uuid",
    "userName": "John Accountant",
    "comment": "Approved, looks good now",
    "action": "APPROVED",
    "createdAt": "2026-02-09T12:00:00.000Z"
  }
]
*/
