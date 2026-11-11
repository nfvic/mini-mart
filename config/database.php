<?php
declare(strict_types=1);

function mm_db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $host = mm_env('SUPABASE_DB_HOST');
    $port = mm_env('SUPABASE_DB_PORT', '5432');
    $name = mm_env('SUPABASE_DB_NAME', 'postgres');
    $user = mm_env('SUPABASE_DB_USER');
    $pass = mm_env('SUPABASE_DB_PASSWORD');

    if ($host === '' || $user === '' || $pass === '') {
        throw new ApiException('Database is not configured. Copy .env.example to .env and set the Supabase Postgres values.', 500);
    }

    $dsn = sprintf(
        'pgsql:host=%s;port=%s;dbname=%s;sslmode=require',
        $host,
        $port,
        $name
    );

    try {
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $e) {
        mm_log('Database connection failed: ' . $e->getMessage());
        throw new ApiException('Could not connect to the database.', 500);
    }

    $pdo->exec('SET search_path TO public, extensions');
    return $pdo;
}
