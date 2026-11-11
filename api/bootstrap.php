<?php
declare(strict_types=1);

if (defined('MM_BOOTED')) {
    return;
}
define('MM_BOOTED', true);

require __DIR__ . '/lib/http.php';
require __DIR__ . '/../config/env.php';
require __DIR__ . '/../config/database.php';
require __DIR__ . '/lib/auth.php';

mm_load_env(dirname(__DIR__) . '/.env');

$configFile = dirname(__DIR__) . '/config/config.php';
if (is_file($configFile)) {
    $config = require $configFile;
    if (is_array($config)) {
        foreach ($config as $key => $value) {
            if (!is_string($key) || mm_env($key) !== '') {
                continue;
            }
            $text = (string) $value;
            putenv($key . '=' . $text);
            $_ENV[$key] = $text;
        }
    }
}

$secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

session_name('MMSESSID');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $secure,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

set_exception_handler(static function (Throwable $e): void {
    if ($e instanceof ApiException) {
        mm_json(['ok' => false, 'error' => $e->getMessage()], $e->status);
    }
    mm_log($e::class . ': ' . $e->getMessage());
    $message = mm_is_dev() ? $e->getMessage() : 'Something went wrong. Please try again.';
    mm_json(['ok' => false, 'error' => $message], 500);
});
