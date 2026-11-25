BEGIN;

-- Create the legal acceptance table using the existing users.id type.
DO $migration$
DECLARE
    user_id_type TEXT;
BEGIN
    SELECT pg_catalog.format_type(a.atttypid, a.atttypmod)
    INTO user_id_type
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = 'public.users'::regclass
      AND a.attname = 'id'
      AND a.attnum > 0
      AND NOT a.attisdropped;

    IF user_id_type IS NULL THEN
        RAISE EXCEPTION 'Unable to determine users.id data type';
    END IF;

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.user_legal_acceptances (
            id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

            user_id %s NOT NULL
                REFERENCES public.users(id)
                ON DELETE CASCADE,

            terms_version VARCHAR(50) NOT NULL,

            privacy_version VARCHAR(50) NOT NULL,

            terms_accepted_at TIMESTAMPTZ NOT NULL
                DEFAULT CURRENT_TIMESTAMP,

            privacy_acknowledged_at TIMESTAMPTZ NOT NULL
                DEFAULT CURRENT_TIMESTAMP,

            registration_method VARCHAR(20) NOT NULL,

            CONSTRAINT legal_registration_method_check
                CHECK (
                    registration_method IN (
                        ''email'', ''google'', ''github''
                    )
                ),

            CONSTRAINT legal_terms_version_check
                CHECK (length(trim(terms_version)) > 0),

            CONSTRAINT legal_privacy_version_check
                CHECK (length(trim(privacy_version)) > 0),

            CONSTRAINT unique_user_legal_versions
                UNIQUE (
                    user_id,
                    terms_version,
                    privacy_version
                )
        )',
        user_id_type
    );
END;
$migration$;

-- Protect acceptance records from direct public access.
ALTER TABLE public.user_legal_acceptances
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_legal_acceptances
FROM PUBLIC;

-- Remove direct Supabase client access where these roles exist.
DO $permissions$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_roles WHERE rolname = 'anon'
    ) THEN
        REVOKE ALL ON TABLE
            public.user_legal_acceptances FROM anon;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_roles WHERE rolname = 'authenticated'
    ) THEN
        REVOKE ALL ON TABLE
            public.user_legal_acceptances FROM authenticated;
    END IF;
END;
$permissions$;

COMMENT ON TABLE public.user_legal_acceptances IS
'Versioned Terms of Service acceptance and Privacy Policy acknowledgment records.';

COMMENT ON COLUMN
public.user_legal_acceptances.registration_method IS
'Authentication method used when the acceptance record was created.';


-- Configure restricted application backend access.
DO $backend_permissions$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_roles
        WHERE rolname = 'tulinkup_backend'
    ) THEN
        REVOKE ALL ON TABLE public.user_legal_acceptances
        FROM tulinkup_backend;

        GRANT INSERT, SELECT
        ON TABLE public.user_legal_acceptances
        TO tulinkup_backend;

        DROP POLICY IF EXISTS legal_backend_insert
        ON public.user_legal_acceptances;

        CREATE POLICY legal_backend_insert
        ON public.user_legal_acceptances
        FOR INSERT
        TO tulinkup_backend
        WITH CHECK (true);

        DROP POLICY IF EXISTS legal_backend_select
        ON public.user_legal_acceptances;

        CREATE POLICY legal_backend_select
        ON public.user_legal_acceptances
        FOR SELECT
        TO tulinkup_backend
        USING (true);
    END IF;
END;
$backend_permissions$;

COMMIT;
