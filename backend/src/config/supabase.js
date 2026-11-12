
// Import the Supabase client to connect the backend to Supabase.
const { createClient } = require("@supabase/supabase-js");

// Get the Supabase URL and secret key from environment variables.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

// Stop the application if the required Supabase settings are missing.
if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SECRET_KEY"
  );
}

// Create the Supabase client for backend operations.
const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      // The backend does not need to refresh user tokens automatically.
      autoRefreshToken: false,

      // Do not save authentication sessions in the backend.
      persistSession: false,
    },
  }
);

// Export the client so other backend files can use it.
module.exports = supabase;
