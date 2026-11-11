<?php
declare(strict_types=1);

function mm_csrf_token(): string
{
    if (empty($_SESSION['csrf']) || !is_string($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function mm_require_csrf(): void
{
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $known = $_SESSION['csrf'] ?? '';
    if (!is_string($sent) || !is_string($known) || $known === '' || !hash_equals($known, $sent)) {
        throw new ApiException('Your session token expired. Refresh the page and try again.', 403);
    }
}

function mm_permissions(PDO $pdo, string $roleId): array
{
    $stmt = $pdo->prepare(
        'SELECT p.key
         FROM permissions p
         JOIN role_permissions rp ON rp.permission_id = p.id
         WHERE rp.role_id = :role
         ORDER BY p.key'
    );
    $stmt->execute(['role' => $roleId]);
    return array_column($stmt->fetchAll(), 'key');
}

function mm_public_user(array $row, array $permissions): array
{
    return [
        'id' => $row['id'],
        'username' => $row['username'],
        'fullName' => $row['full_name'],
        'role' => $row['role_name'],
        'roleId' => $row['role_id'],
        'email' => $row['email'],
        'phone' => $row['phone'],
        'active' => (bool) $row['active'],
        'permissions' => $permissions,
    ];
}

function mm_user_by_id(PDO $pdo, string $id): ?array
{
    $stmt = $pdo->prepare(
        'SELECT u.*, r.name AS role_name
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.id = :id'
    );
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function mm_current_user(): ?array
{
    static $loaded = false;
    static $user = null;
    if ($loaded) {
        return $user;
    }
    $loaded = true;
    $id = $_SESSION['user_id'] ?? null;
    if (!is_string($id) || $id === '') {
        return null;
    }
    $row = mm_user_by_id(mm_db(), $id);
    if (!$row || !$row['active']) {
        $_SESSION = [];
        return null;
    }
    $permissions = mm_permissions(mm_db(), $row['role_id']);
    $user = mm_public_user($row, $permissions);
    return $user;
}

function mm_require_user(): array
{
    $user = mm_current_user();
    if (!$user) {
        throw new ApiException('Please sign in.', 401);
    }
    return $user;
}

function mm_can(array $user, string $permission): bool
{
    return in_array($permission, $user['permissions'], true);
}

function mm_can_view_costs(array $user): bool
{
    return mm_can($user, 'accounting') || mm_can($user, 'purchases');
}

function mm_require_perm(string $permission): array
{
    $user = mm_require_user();
    if (!mm_can($user, $permission)) {
        throw new ApiException('You do not have permission to do that.', 403);
    }
    return $user;
}

function mm_can_read(array $user, string $resource): bool
{
    $map = [
        'products' => ['products', 'inventory', 'sales', 'purchases', 'reports', 'accounting', 'dashboard'],
        'sales' => ['sales', 'reports', 'accounting', 'customers'],
        'purchases' => ['purchases', 'reports', 'accounting', 'suppliers'],
        'customers' => ['customers', 'sales', 'reports'],
        'suppliers' => ['suppliers', 'purchases', 'reports'],
        'expenses' => ['expenses', 'accounting', 'reports'],
        'users' => ['users'],
        'settings' => ['dashboard', 'settings', 'sales', 'profile'],
    ];
    foreach ($map[$resource] ?? [] as $permission) {
        if (mm_can($user, $permission)) {
            return true;
        }
    }
    return false;
}

function mm_require_read(string $resource): array
{
    $user = mm_require_user();
    if (!mm_can_read($user, $resource)) {
        throw new ApiException('You do not have permission to view that.', 403);
    }
    return $user;
}

function mm_audit(PDO $pdo, ?string $userId, string $action, string $entity, string $entityId, array $details = []): void
{
    $stmt = $pdo->prepare(
        'INSERT INTO audit_logs (user_id, action, entity, entity_id, details, ip_address)
         VALUES (:user_id, :action, :entity, :entity_id, CAST(:details AS jsonb), :ip)'
    );
    $stmt->execute([
        'user_id' => $userId,
        'action' => $action,
        'entity' => $entity,
        'entity_id' => $entityId,
        'details' => json_encode($details, JSON_UNESCAPED_UNICODE) ?: '{}',
        'ip' => mm_client_ip(),
    ]);
}

function mm_login(PDO $pdo, string $username, string $password, bool $remember): array
{
    $username = mm_text($username, 40, 'Username');
    if ($password === '' || strlen($password) > 200) {
        throw new ApiException('Invalid username or password.', 401);
    }

    $recent = $pdo->prepare(
        "SELECT COUNT(*) FROM login_attempts
         WHERE username = :username AND success = FALSE AND created_at > now() - interval '15 minutes'"
    );
    $recent->execute(['username' => strtolower($username)]);
    if ((int) $recent->fetchColumn() >= 8) {
        throw new ApiException('Too many sign-in attempts. Try again in 15 minutes.', 429);
    }

    $stmt = $pdo->prepare(
        'SELECT u.*, r.name AS role_name
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE lower(u.username) = lower(:username)'
    );
    $stmt->execute(['username' => $username]);
    $row = $stmt->fetch();
    $valid = $row && password_verify($password, $row['password_hash']);

    $attempt = $pdo->prepare(
        'INSERT INTO login_attempts (username, ip_address, success) VALUES (:username, :ip, CAST(:success AS boolean))'
    );
    $attempt->execute([
        'username' => strtolower($username),
        'ip' => mm_client_ip(),
        'success' => $valid ? 'true' : 'false',
    ]);

    if (!$row || !$valid) {
        throw new ApiException('Invalid username or password.', 401);
    }
    if (!$row['active']) {
        throw new ApiException('This account is disabled. Contact the administrator.', 403);
    }

    if (password_needs_rehash($row['password_hash'], PASSWORD_DEFAULT)) {
        $update = $pdo->prepare('UPDATE users SET password_hash = :hash, updated_at = now() WHERE id = :id');
        $update->execute(['hash' => password_hash($password, PASSWORD_DEFAULT), 'id' => $row['id']]);
    }

    session_regenerate_id(true);
    $_SESSION = [];
    $_SESSION['user_id'] = $row['id'];
    $_SESSION['csrf'] = bin2hex(random_bytes(32));

    $params = session_get_cookie_params();
    setcookie(session_name(), session_id(), [
        'expires' => $remember ? time() + 60 * 60 * 24 * 14 : 0,
        'path' => $params['path'] ?: '/',
        'secure' => (bool) $params['secure'],
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    mm_audit($pdo, $row['id'], 'login', 'user', $row['id']);
    $permissions = mm_permissions($pdo, $row['role_id']);
    return mm_public_user($row, $permissions);
}

function mm_logout(PDO $pdo): void
{
    $user = mm_current_user();
    if ($user) {
        mm_audit($pdo, $user['id'], 'logout', 'user', $user['id']);
    }
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $params['path'] ?: '/',
            'secure' => (bool) $params['secure'],
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }
    session_destroy();
}
