<?php
/**
 * Optional PHP config if you are not using a .env file.
 * Copy to config.php (gitignored) and fill in the same values as .env.example.
 * Environment variables take priority over this file.
 */
return [
    'SUPABASE_DB_HOST' => 'db.your-project-ref.supabase.co',
    'SUPABASE_DB_PORT' => '5432',
    'SUPABASE_DB_NAME' => 'postgres',
    'SUPABASE_DB_USER' => 'postgres',
    'SUPABASE_DB_PASSWORD' => 'replace-with-database-password',
    'APP_ENV' => 'development',
    'APP_SECRET' => 'replace-with-a-long-random-string',
];
