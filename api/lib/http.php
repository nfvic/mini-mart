<?php
declare(strict_types=1);

class ApiException extends RuntimeException
{
    public function __construct(string $message, public int $status = 400)
    {
        parent::__construct($message);
    }
}

function mm_log(string $message): void
{
    $dir = dirname(__DIR__, 2) . '/logs';
    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }
    $line = gmdate('c') . ' ' . str_replace(["\r", "\n"], ' ', $message) . PHP_EOL;
    file_put_contents($dir . '/app.log', $line, FILE_APPEND);
}

function mm_json(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: same-origin');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
    exit;
}

function mm_ok(array $data = [], int $status = 200): never
{
    if (!empty($_SESSION['csrf'])) {
        $data['csrf'] = $_SESSION['csrf'];
    }
    $data['ok'] = true;
    mm_json($data, $status);
}

function mm_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    if (strlen($raw) > 5 * 1024 * 1024) {
        throw new ApiException('Request body is too large.', 413);
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        throw new ApiException('Invalid JSON body.', 400);
    }
    return $data;
}

function mm_text(mixed $value, int $max, string $label, bool $required = true): string
{
    $text = trim(strip_tags((string) ($value ?? '')));
    if ($text === '' && $required) {
        throw new ApiException($label . ' is required.', 422);
    }
    if (strlen($text) > $max) {
        throw new ApiException($label . ' is too long.', 422);
    }
    return $text;
}

function mm_money(mixed $value, string $label, bool $allowZero = true): string
{
    if (!is_numeric($value)) {
        throw new ApiException($label . ' must be a number.', 422);
    }
    $number = round((float) $value, 2);
    if ($number < 0 || (!$allowZero && $number <= 0) || $number > 100000000) {
        throw new ApiException($label . ' is out of range.', 422);
    }
    return number_format($number, 2, '.', '');
}

function mm_qty(mixed $value, bool $allowZero = false): int
{
    if (!is_numeric($value)) {
        throw new ApiException('Quantity must be a whole number.', 422);
    }
    $number = (float) $value;
    if ((int) $number != $number) {
        throw new ApiException('Quantity must be a whole number.', 422);
    }
    $qty = (int) $number;
    $min = $allowZero ? 0 : 1;
    if ($qty < $min || $qty > 100000) {
        throw new ApiException('Quantity is out of range.', 422);
    }
    return $qty;
}

function mm_date_input(mixed $value): string
{
    $date = trim((string) ($value ?? ''));
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        throw new ApiException('Enter a valid date.', 422);
    }
    $parts = explode('-', $date);
    if (!checkdate((int) $parts[1], (int) $parts[2], (int) $parts[0])) {
        throw new ApiException('Enter a valid date.', 422);
    }
    return $date;
}

function mm_payment(mixed $value): string
{
    $method = trim((string) ($value ?? ''));
    $allowed = ['Cash', 'M-Pesa', 'Bank transfer', 'Card'];
    if (!in_array($method, $allowed, true)) {
        throw new ApiException('Choose a valid payment method.', 422);
    }
    return $method;
}

function mm_new_id(string $prefix): string
{
    return $prefix . '_' . bin2hex(random_bytes(6));
}

function mm_iso(?string $value): string
{
    if ($value === null || $value === '') {
        return '';
    }
    $time = strtotime($value);
    if ($time === false) {
        return $value;
    }
    return date('c', $time);
}

function mm_day(?string $value): string
{
    if ($value === null || $value === '') {
        return '';
    }
    return substr($value, 0, 10);
}

function mm_exec_script(PDO $pdo, string $sql): void
{
    $sql = preg_replace('/--.*$/m', '', $sql) ?? $sql;
    $parts = preg_split('/;\s*(?:\r?\n|$)/', $sql) ?: [];
    foreach ($parts as $part) {
        $statement = trim($part);
        if ($statement === '') {
            continue;
        }
        $pdo->exec($statement);
    }
}

function mm_client_ip(): string
{
    return substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 64);
}
