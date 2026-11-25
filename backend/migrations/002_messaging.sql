BEGIN;

-- 1. Direct student-to-tutor conversations.
CREATE TABLE public.conversations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    student_id BIGINT NOT NULL
        REFERENCES public.users(id),

    tutor_id BIGINT NOT NULL
        REFERENCES public.users(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT conversations_unique_pair
        UNIQUE (student_id, tutor_id),

    CONSTRAINT conversations_different_users
        CHECK (student_id <> tutor_id)
);

-- 2. Conversation membership and read tracking.
CREATE TABLE public.conversation_participants (
    conversation_id BIGINT NOT NULL
        REFERENCES public.conversations(id)
        ON DELETE CASCADE,

    user_id BIGINT NOT NULL
        REFERENCES public.users(id),

    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_read_message_id BIGINT,

    PRIMARY KEY (conversation_id, user_id)
);

-- 3. Private text messages.
CREATE TABLE public.messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    conversation_id BIGINT NOT NULL,
    sender_id BIGINT NOT NULL,

    client_message_id UUID NOT NULL,
    body TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT messages_sender_membership
        FOREIGN KEY (conversation_id, sender_id)
        REFERENCES public.conversation_participants(
            conversation_id, user_id
        ),

    CONSTRAINT messages_body_length
        CHECK (
            CHAR_LENGTH(BTRIM(body)) BETWEEN 1 AND 4000
            AND CHAR_LENGTH(body) <= 4000
        ),

    CONSTRAINT messages_prevent_duplicates
        UNIQUE (
            conversation_id,
            sender_id,
            client_message_id
        ),

    CONSTRAINT messages_conversation_id_pair
        UNIQUE (conversation_id, id)
);

-- Ensure read markers belong to the same conversation.
ALTER TABLE public.conversation_participants
ADD CONSTRAINT participants_last_read_message
FOREIGN KEY (conversation_id, last_read_message_id)
REFERENCES public.messages(conversation_id, id);

-- 4. User blocking.
CREATE TABLE public.user_blocks (
    blocker_id BIGINT NOT NULL
        REFERENCES public.users(id),

    blocked_id BIGINT NOT NULL
        REFERENCES public.users(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (blocker_id, blocked_id),

    CONSTRAINT user_blocks_no_self_block
        CHECK (blocker_id <> blocked_id)
);

-- 5. Message reporting.
CREATE TABLE public.message_reports (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    conversation_id BIGINT NOT NULL,
    message_id BIGINT NOT NULL,
    reporter_id BIGINT NOT NULL,

    reason VARCHAR(40) NOT NULL,
    details TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'pending',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,

    reviewed_by BIGINT
        REFERENCES public.users(id),

    CONSTRAINT reports_message_membership
        FOREIGN KEY (conversation_id, message_id)
        REFERENCES public.messages(conversation_id, id),

    CONSTRAINT reports_reporter_membership
        FOREIGN KEY (conversation_id, reporter_id)
        REFERENCES public.conversation_participants(
            conversation_id, user_id
        ),

    CONSTRAINT message_reports_unique
        UNIQUE (message_id, reporter_id),

    CONSTRAINT message_reports_reason
        CHECK (
            reason IN (
                'spam',
                'harassment',
                'inappropriate_content',
                'safety_concern',
                'payment_solicitation',
                'other'
            )
        ),

    CONSTRAINT message_reports_status
        CHECK (
            status IN (
                'pending',
                'reviewing',
                'resolved',
                'dismissed'
            )
        ),

    CONSTRAINT message_reports_details_length
        CHECK (
            details IS NULL
            OR CHAR_LENGTH(details) <= 2000
        )
);

-- Performance indexes.
CREATE INDEX conversations_student_idx
ON public.conversations(student_id, updated_at DESC);

CREATE INDEX conversations_tutor_idx
ON public.conversations(tutor_id, updated_at DESC);

CREATE INDEX participants_user_idx
ON public.conversation_participants(user_id);

CREATE INDEX messages_history_idx
ON public.messages(conversation_id, id DESC);

CREATE INDEX messages_sender_idx
ON public.messages(sender_id, created_at DESC);

CREATE INDEX user_blocks_blocked_idx
ON public.user_blocks(blocked_id);

CREATE INDEX message_reports_status_idx
ON public.message_reports(status, created_at DESC);

-- Restrict messaging tables to the backend.
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'conversations',
        'conversation_participants',
        'messages',
        'user_blocks',
        'message_reports'
    ]
    LOOP
        EXECUTE format(
            'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
            table_name
        );

        EXECUTE format(
            'REVOKE ALL ON TABLE public.%I
             FROM PUBLIC, anon, authenticated, service_role',
            table_name
        );

        EXECUTE format(
            'GRANT SELECT, INSERT ON TABLE public.%I
             TO tulinkup_backend',
            table_name
        );

        EXECUTE format(
            'CREATE POLICY backend_select ON public.%I
             FOR SELECT TO tulinkup_backend
             USING (true)',
            table_name
        );

        EXECUTE format(
            'CREATE POLICY backend_insert ON public.%I
             FOR INSERT TO tulinkup_backend
             WITH CHECK (true)',
            table_name
        );
    END LOOP;
END $$;

-- Limited update permissions.
GRANT UPDATE (updated_at)
ON public.conversations TO tulinkup_backend;

CREATE POLICY backend_update
ON public.conversations
FOR UPDATE TO tulinkup_backend
USING (true) WITH CHECK (true);

GRANT UPDATE (last_read_message_id)
ON public.conversation_participants TO tulinkup_backend;

CREATE POLICY backend_update
ON public.conversation_participants
FOR UPDATE TO tulinkup_backend
USING (true) WITH CHECK (true);

GRANT UPDATE (status, reviewed_at, reviewed_by)
ON public.message_reports TO tulinkup_backend;

CREATE POLICY backend_update
ON public.message_reports
FOR UPDATE TO tulinkup_backend
USING (true) WITH CHECK (true);

-- Allow users to unblock through the backend.
GRANT DELETE ON public.user_blocks TO tulinkup_backend;

CREATE POLICY backend_delete
ON public.user_blocks
FOR DELETE TO tulinkup_backend
USING (true);

-- Identity sequence permissions.
REVOKE ALL ON SEQUENCE
    public.conversations_id_seq,
    public.messages_id_seq,
    public.message_reports_id_seq
FROM PUBLIC, anon, authenticated, service_role;

GRANT USAGE, SELECT ON SEQUENCE
    public.conversations_id_seq,
    public.messages_id_seq,
    public.message_reports_id_seq
TO tulinkup_backend;

COMMIT;
