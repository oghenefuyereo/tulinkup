-- TuLinkUp student learning profiles.
-- Keep learning information separate from private accounts.
-- Apply this migration within a database transaction.

CREATE TABLE public.student_profiles (
    user_id BIGINT PRIMARY KEY,

    display_name VARCHAR(150),

    biography TEXT NOT NULL DEFAULT '',

    learning_interests TEXT NOT NULL DEFAULT '',

    education TEXT NOT NULL DEFAULT '',

    learning_goals TEXT NOT NULL DEFAULT '',

    profile_image_path TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT student_profiles_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON DELETE CASCADE,

    CONSTRAINT student_profiles_display_name_check
        CHECK (
            display_name IS NULL
            OR (
                char_length(btrim(display_name))
                BETWEEN 2 AND 150
            )
        ),

    CONSTRAINT student_profiles_biography_check
        CHECK (char_length(biography) <= 1500),

    CONSTRAINT student_profiles_interests_check
        CHECK (char_length(learning_interests) <= 1000),

    CONSTRAINT student_profiles_education_check
        CHECK (char_length(education) <= 1000),

    CONSTRAINT student_profiles_goals_check
        CHECK (char_length(learning_goals) <= 1000),

    CONSTRAINT student_profiles_image_path_check
        CHECK (
            profile_image_path IS NULL
            OR (
                char_length(profile_image_path) <= 500
                AND profile_image_path ~ (
                    '^' || user_id::text ||
                    '/[a-f0-9-]{36}[.]webp$'
                )
            )
        )
);

-- Student profiles are accessible only through authorized
-- backend operations. No public database access.

ALTER TABLE public.student_profiles
    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.student_profiles
    FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE public.student_profiles IS
    'Private student learning profiles managed through authorized backend APIs.';

COMMENT ON COLUMN public.student_profiles.profile_image_path IS
    'Private storage object path, not a public image URL.';


-- BEGIN BACKEND ACCESS POLICIES

-- Restrict access to the dedicated application role.
REVOKE ALL ON TABLE public.student_profiles
    FROM tulinkup_backend;

GRANT SELECT, INSERT, UPDATE
    ON TABLE public.student_profiles
    TO tulinkup_backend;

-- Allow the backend to read active student profiles.
CREATE POLICY student_profiles_backend_select
ON public.student_profiles
FOR SELECT
TO tulinkup_backend
USING (
    EXISTS (
        SELECT 1
        FROM public.users AS u
        WHERE u.id = student_profiles.user_id
          AND u.role = 'student'
          AND u.account_status = 'active'
    )
);

-- Allow the backend to create active student profiles.
CREATE POLICY student_profiles_backend_insert
ON public.student_profiles
FOR INSERT
TO tulinkup_backend
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.users AS u
        WHERE u.id = student_profiles.user_id
          AND u.role = 'student'
          AND u.account_status = 'active'
    )
);

-- Allow the backend to update active student profiles.
CREATE POLICY student_profiles_backend_update
ON public.student_profiles
FOR UPDATE
TO tulinkup_backend
USING (
    EXISTS (
        SELECT 1
        FROM public.users AS u
        WHERE u.id = student_profiles.user_id
          AND u.role = 'student'
          AND u.account_status = 'active'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.users AS u
        WHERE u.id = student_profiles.user_id
          AND u.role = 'student'
          AND u.account_status = 'active'
    )
);

-- END BACKEND ACCESS POLICIES

