<?php
declare(strict_types=1);

function mm_bool(mixed $value): bool
{
    return $value === true || $value === 1 || $value === '1' || $value === 't' || $value === 'true';
}

function mm_num(mixed $value): float
{
    return round((float) $value, 2);
}

function mm_id(mixed $value, bool $required = true): string
{
    $id = trim((string) ($value ?? ''));
    if ($id === '') {
        if ($required) {
            throw new ApiException('A record id is required.', 422);
        }
        return '';
    }
    if (!preg_match('/^[A-Za-z0-9_\-]{1,40}$/', $id)) {
        throw new ApiException('Invalid record id.', 422);
    }
    return $id;
}

function mm_request_id(mixed $value): ?string
{
    $id = trim((string) ($value ?? ''));
    if ($id === '') {
        return null;
    }
    if (!preg_match('/^[A-Za-z0-9_\-]{8,80}$/', $id)) {
        throw new ApiException('Invalid request id.', 422);
    }
    return $id;
}

function mm_role_id(string $roleName): string
{
    return match ($roleName) {
        'Administrator' => 'role_admin',
        'Cashier' => 'role_cashier',
        'Accountant' => 'role_accountant',
        'Storekeeper' => 'role_store',
        default => throw new ApiException('Choose a valid role.', 422),
    };
}

function mm_db_unique(PDOException $e): bool
{
    return (string) $e->getCode() === '23505';
}

function mm_db_fk(PDOException $e): bool
{
    return (string) $e->getCode() === '23503';
}

function mm_setting(PDO $pdo, string $key, string $default = ''): string
{
    $stmt = $pdo->prepare('SELECT value FROM business_settings WHERE key = :key');
    $stmt->execute(['key' => $key]);
    $value = $stmt->fetchColumn();
    return $value === false ? $default : (string) $value;
}

function mm_settings(PDO $pdo): array
{
    $rows = $pdo->query('SELECT key, value FROM business_settings')->fetchAll();
    $map = [];
    foreach ($rows as $row) {
        $map[$row['key']] = $row['value'];
    }
    return [
        'supermarketName' => $map['supermarket_name'] ?? 'MiniMart Supermarket',
        'logoDataUrl' => $map['logo_data_url'] ?? '',
        'currency' => $map['currency'] ?? 'KES',
        'phone' => $map['phone'] ?? '',
        'email' => $map['email'] ?? '',
        'address' => $map['address'] ?? '',
        'receiptFooter' => $map['receipt_footer'] ?? '',
        'taxRate' => (float) ($map['tax_rate'] ?? 0),
    ];
}

function mm_save_settings(PDO $pdo, array $body): array
{
    mm_require_perm('settings');
    $logo = (string) ($body['logoDataUrl'] ?? '');
    if ($logo !== '' && !preg_match('#^data:image/(png|jpeg|jpg|gif|webp);base64,#', $logo)) {
        throw new ApiException('Logo must be a PNG, JPEG, GIF or WebP image.', 422);
    }
    if (strlen($logo) > 700000) {
        throw new ApiException('Logo image is too large.', 422);
    }
    $tax = mm_money($body['taxRate'] ?? 0, 'Tax rate');
    if ((float) $tax > 100) {
        throw new ApiException('Tax rate cannot exceed 100%.', 422);
    }
    $pairs = [
        'supermarket_name' => mm_text($body['supermarketName'] ?? '', 80, 'Supermarket name'),
        'logo_data_url' => $logo,
        'currency' => 'KES',
        'phone' => mm_text($body['phone'] ?? '', 40, 'Phone', false),
        'email' => mm_text($body['email'] ?? '', 80, 'Email', false),
        'address' => mm_text($body['address'] ?? '', 160, 'Address', false),
        'receipt_footer' => mm_text($body['receiptFooter'] ?? '', 240, 'Receipt footer', false),
        'tax_rate' => $tax,
    ];
    $stmt = $pdo->prepare(
        'INSERT INTO business_settings (key, value, updated_at)
         VALUES (:key, :value, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()'
    );
    foreach ($pairs as $key => $value) {
        $stmt->execute(['key' => $key, 'value' => $value]);
    }
    mm_audit($pdo, mm_current_user()['id'], 'update', 'settings', 'business');
    return mm_settings($pdo);
}

function mm_map_product(array $row): array
{
    return [
        'id' => $row['id'],
        'code' => $row['code'],
        'name' => $row['name'],
        'category' => $row['category_name'],
        'buyingPrice' => mm_num($row['buying_price']),
        'sellingPrice' => mm_num($row['selling_price']),
        'stock' => (int) $row['stock'],
        'minStock' => (int) $row['min_stock'],
        'unit' => $row['unit'],
    ];
}

function mm_products(PDO $pdo): array
{
    $sql = 'SELECT p.*, c.name AS category_name
            FROM products p
            JOIN categories c ON c.id = p.category_id
            ORDER BY p.name';
    return array_map('mm_map_product', $pdo->query($sql)->fetchAll());
}

function mm_category_id(PDO $pdo, string $name): string
{
    $name = mm_text($name, 80, 'Category');
    $stmt = $pdo->prepare('SELECT id FROM categories WHERE name = :name');
    $stmt->execute(['name' => $name]);
    $id = $stmt->fetchColumn();
    if ($id) {
        return (string) $id;
    }
    $id = mm_new_id('cat');
    $insert = $pdo->prepare('INSERT INTO categories (id, name) VALUES (:id, :name)');
    $insert->execute(['id' => $id, 'name' => $name]);
    return $id;
}

function mm_save_product(PDO $pdo, array $body, bool $creating): array
{
    mm_require_perm('products');
    $code = mm_text($body['code'] ?? '', 30, 'Product code');
    $name = mm_text($body['name'] ?? '', 80, 'Product name');
    $buying = mm_money($body['buyingPrice'] ?? null, 'Buying price');
    $selling = mm_money($body['sellingPrice'] ?? null, 'Selling price');
    if ((float) $selling < (float) $buying) {
        throw new ApiException('Selling price should not be below buying price.', 422);
    }
    $stock = mm_qty($body['stock'] ?? 0, true);
    $min = mm_qty($body['minStock'] ?? 0, true);
    $unit = mm_text($body['unit'] ?? 'unit', 30, 'Unit', false) ?: 'unit';
    $categoryId = mm_category_id($pdo, (string) ($body['category'] ?? ''));
    $id = $creating ? mm_new_id('prd') : mm_id($body['id'] ?? '');

    $dup = $pdo->prepare('SELECT id FROM products WHERE lower(code) = lower(:code) AND id <> :id');
    $dup->execute(['code' => $code, 'id' => $id]);
    if ($dup->fetchColumn()) {
        throw new ApiException('Product code already exists.', 422);
    }

    try {
        if ($creating) {
            $stmt = $pdo->prepare(
                'INSERT INTO products
                 (id, code, name, category_id, buying_price, selling_price, stock, min_stock, unit)
                 VALUES (:id, :code, :name, :category, :buying, :selling, :stock, :min_stock, :unit)'
            );
        } else {
            $stmt = $pdo->prepare(
                'UPDATE products SET
                   code = :code, name = :name, category_id = :category,
                   buying_price = :buying, selling_price = :selling,
                   stock = :stock, min_stock = :min_stock, unit = :unit, updated_at = now()
                 WHERE id = :id'
            );
        }
        $stmt->execute([
            'id' => $id,
            'code' => $code,
            'name' => $name,
            'category' => $categoryId,
            'buying' => $buying,
            'selling' => $selling,
            'stock' => $stock,
            'min_stock' => $min,
            'unit' => $unit,
        ]);
    } catch (PDOException $e) {
        if (mm_db_unique($e)) {
            throw new ApiException('Product code already exists.', 422);
        }
        throw $e;
    }
    mm_audit($pdo, mm_current_user()['id'], $creating ? 'create' : 'update', 'product', $id);
    $row = $pdo->prepare(
        'SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = :id'
    );
    $row->execute(['id' => $id]);
    return mm_map_product($row->fetch());
}

function mm_delete_product(PDO $pdo, string $id): void
{
    mm_require_perm('products');
    $id = mm_id($id);
    try {
        $stmt = $pdo->prepare('DELETE FROM products WHERE id = :id');
        $stmt->execute(['id' => $id]);
    } catch (PDOException $e) {
        if (mm_db_fk($e)) {
            throw new ApiException('This product is used on a sale or purchase and cannot be deleted.', 409);
        }
        throw $e;
    }
    if ($stmt->rowCount() === 0) {
        throw new ApiException('Product not found.', 404);
    }
    mm_audit($pdo, mm_current_user()['id'], 'delete', 'product', $id);
}

function mm_map_supplier(array $row): array
{
    return [
        'id' => $row['id'],
        'name' => $row['name'],
        'phone' => $row['phone'],
        'email' => $row['email'],
        'address' => $row['address'],
        'notes' => $row['notes'],
    ];
}

function mm_suppliers(PDO $pdo): array
{
    return array_map('mm_map_supplier', $pdo->query('SELECT * FROM suppliers ORDER BY name')->fetchAll());
}

function mm_save_supplier(PDO $pdo, array $body, bool $creating): array
{
    mm_require_perm('suppliers');
    $id = $creating ? mm_new_id('sup') : mm_id($body['id'] ?? '');
    $payload = [
        'id' => $id,
        'name' => mm_text($body['name'] ?? '', 80, 'Supplier name'),
        'phone' => mm_text($body['phone'] ?? '', 40, 'Phone'),
        'email' => mm_text($body['email'] ?? '', 80, 'Email', false),
        'address' => mm_text($body['address'] ?? '', 160, 'Address', false),
        'notes' => mm_text($body['notes'] ?? '', 240, 'Notes', false),
    ];
    if ($creating) {
        $stmt = $pdo->prepare(
            'INSERT INTO suppliers (id, name, phone, email, address, notes)
             VALUES (:id, :name, :phone, :email, :address, :notes)'
        );
    } else {
        $stmt = $pdo->prepare(
            'UPDATE suppliers SET name = :name, phone = :phone, email = :email,
             address = :address, notes = :notes, updated_at = now() WHERE id = :id'
        );
    }
    $stmt->execute($payload);
    if (!$creating) {
        $exists = $pdo->prepare('SELECT 1 FROM suppliers WHERE id = :id');
        $exists->execute(['id' => $id]);
        if (!$exists->fetchColumn()) {
            throw new ApiException('Supplier not found.', 404);
        }
    }
    mm_audit($pdo, mm_current_user()['id'], $creating ? 'create' : 'update', 'supplier', $id);
    return $payload;
}

function mm_delete_supplier(PDO $pdo, string $id): void
{
    mm_require_perm('suppliers');
    $id = mm_id($id);
    try {
        $stmt = $pdo->prepare('DELETE FROM suppliers WHERE id = :id');
        $stmt->execute(['id' => $id]);
    } catch (PDOException $e) {
        if (mm_db_fk($e)) {
            throw new ApiException('This supplier has purchases and cannot be deleted.', 409);
        }
        throw $e;
    }
    if ($stmt->rowCount() === 0) {
        throw new ApiException('Supplier not found.', 404);
    }
    mm_audit($pdo, mm_current_user()['id'], 'delete', 'supplier', $id);
}

function mm_map_customer(array $row): array
{
    return [
        'id' => $row['id'],
        'name' => $row['name'],
        'phone' => $row['phone'],
        'email' => $row['email'],
        'address' => $row['address'],
        'isWalkIn' => mm_bool($row['is_walk_in']),
    ];
}

function mm_customers(PDO $pdo): array
{
    return array_map('mm_map_customer', $pdo->query('SELECT * FROM customers ORDER BY is_walk_in DESC, name')->fetchAll());
}

function mm_save_customer(PDO $pdo, array $body, bool $creating): array
{
    mm_require_perm('customers');
    $id = $creating ? mm_new_id('cust') : mm_id($body['id'] ?? '');
    if (!$creating) {
        $existing = $pdo->prepare('SELECT is_walk_in FROM customers WHERE id = :id');
        $existing->execute(['id' => $id]);
        $flag = $existing->fetchColumn();
        if ($flag === false) {
            throw new ApiException('Customer not found.', 404);
        }
        if (mm_bool($flag)) {
            throw new ApiException('Walk-in customer cannot be edited.', 422);
        }
    }
    $payload = [
        'id' => $id,
        'name' => mm_text($body['name'] ?? '', 80, 'Customer name'),
        'phone' => mm_text($body['phone'] ?? '', 40, 'Phone'),
        'email' => mm_text($body['email'] ?? '', 80, 'Email', false),
        'address' => mm_text($body['address'] ?? '', 160, 'Address', false),
    ];
    if ($creating) {
        $stmt = $pdo->prepare(
            'INSERT INTO customers (id, name, phone, email, address, is_walk_in)
             VALUES (:id, :name, :phone, :email, :address, FALSE)'
        );
    } else {
        $stmt = $pdo->prepare(
            'UPDATE customers SET name = :name, phone = :phone, email = :email, address = :address, updated_at = now()
             WHERE id = :id AND is_walk_in = FALSE'
        );
    }
    $stmt->execute($payload);
    mm_audit($pdo, mm_current_user()['id'], $creating ? 'create' : 'update', 'customer', $id);
    $payload['isWalkIn'] = false;
    return $payload;
}

function mm_delete_customer(PDO $pdo, string $id): void
{
    mm_require_perm('customers');
    $id = mm_id($id);
    $existing = $pdo->prepare('SELECT is_walk_in FROM customers WHERE id = :id');
    $existing->execute(['id' => $id]);
    $flag = $existing->fetchColumn();
    if ($flag === false) {
        throw new ApiException('Customer not found.', 404);
    }
    if (mm_bool($flag)) {
        throw new ApiException('Walk-in customer cannot be deleted.', 422);
    }
    try {
        $stmt = $pdo->prepare('DELETE FROM customers WHERE id = :id AND is_walk_in = FALSE');
        $stmt->execute(['id' => $id]);
    } catch (PDOException $e) {
        if (mm_db_fk($e)) {
            throw new ApiException('This customer has sales and cannot be deleted.', 409);
        }
        throw $e;
    }
    mm_audit($pdo, mm_current_user()['id'], 'delete', 'customer', $id);
}

function mm_map_expense(array $row): array
{
    return [
        'id' => $row['id'],
        'description' => $row['description'],
        'category' => $row['category'],
        'amount' => mm_num($row['amount']),
        'date' => mm_day($row['expense_date']),
        'paymentMethod' => $row['payment_method'],
    ];
}

function mm_expenses(PDO $pdo): array
{
    return array_map(
        'mm_map_expense',
        $pdo->query('SELECT * FROM expenses ORDER BY expense_date DESC, created_at DESC')->fetchAll()
    );
}

function mm_save_expense(PDO $pdo, array $body, bool $creating): array
{
    mm_require_perm('expenses');
    $id = $creating ? mm_new_id('exp') : mm_id($body['id'] ?? '');
    $category = mm_text($body['category'] ?? '', 60, 'Category');
    $known = $pdo->prepare('SELECT 1 FROM expense_categories WHERE name = :name');
    $known->execute(['name' => $category]);
    if (!$known->fetchColumn()) {
        throw new ApiException('Choose a valid expense category.', 422);
    }
    $amount = mm_money($body['amount'] ?? null, 'Amount', false);
    $payload = [
        'id' => $id,
        'description' => mm_text($body['description'] ?? '', 160, 'Description'),
        'category' => $category,
        'amount' => $amount,
        'date' => mm_date_input($body['date'] ?? ''),
        'payment' => mm_payment($body['paymentMethod'] ?? ''),
        'user' => mm_current_user()['id'],
    ];
    $pdo->beginTransaction();
    try {
        if ($creating) {
            $stmt = $pdo->prepare(
                'INSERT INTO expenses (id, description, category, amount, expense_date, payment_method, created_by)
                 VALUES (:id, :description, :category, :amount, :date, :payment, :user)'
            );
            $stmt->execute($payload);
            $pay = $pdo->prepare(
                'INSERT INTO payments (id, reference_type, reference_id, amount, method)
                 VALUES (:id, \'expense\', :ref, :amount, :method)'
            );
            $pay->execute([
                'id' => mm_new_id('pay'),
                'ref' => $id,
                'amount' => $amount,
                'method' => $payload['payment'],
            ]);
        } else {
            $stmt = $pdo->prepare(
                'UPDATE expenses SET description = :description, category = :category, amount = :amount,
                 expense_date = :date, payment_method = :payment, updated_at = now() WHERE id = :id'
            );
            $stmt->execute([
                'id' => $id,
                'description' => $payload['description'],
                'category' => $category,
                'amount' => $amount,
                'date' => $payload['date'],
                'payment' => $payload['payment'],
            ]);
            $exists = $pdo->prepare('SELECT 1 FROM expenses WHERE id = :id');
            $exists->execute(['id' => $id]);
            if (!$exists->fetchColumn()) {
                throw new ApiException('Expense not found.', 404);
            }
            $pay = $pdo->prepare(
                'UPDATE payments SET amount = :amount, method = :method WHERE reference_type = \'expense\' AND reference_id = :ref'
            );
            $pay->execute(['amount' => $amount, 'method' => $payload['payment'], 'ref' => $id]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    mm_audit($pdo, mm_current_user()['id'], $creating ? 'create' : 'update', 'expense', $id);
    return mm_map_expense([
        'id' => $id,
        'description' => $payload['description'],
        'category' => $category,
        'amount' => $amount,
        'expense_date' => $payload['date'],
        'payment_method' => $payload['payment'],
    ]);
}

function mm_delete_expense(PDO $pdo, string $id): void
{
    mm_require_perm('expenses');
    $id = mm_id($id);
    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM payments WHERE reference_type = \'expense\' AND reference_id = :id')->execute(['id' => $id]);
        $stmt = $pdo->prepare('DELETE FROM expenses WHERE id = :id');
        $stmt->execute(['id' => $id]);
        if ($stmt->rowCount() === 0) {
            throw new ApiException('Expense not found.', 404);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    mm_audit($pdo, mm_current_user()['id'], 'delete', 'expense', $id);
}

function mm_users(PDO $pdo): array
{
    mm_require_perm('users');
    $rows = $pdo->query(
        'SELECT u.id, u.username, u.full_name, u.email, u.phone, u.active, r.name AS role_name
         FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.full_name'
    )->fetchAll();
    return array_map(static function (array $row): array {
        return [
            'id' => $row['id'],
            'username' => $row['username'],
            'fullName' => $row['full_name'],
            'role' => $row['role_name'],
            'email' => $row['email'],
            'phone' => $row['phone'],
            'active' => mm_bool($row['active']),
        ];
    }, $rows);
}

function mm_save_user(PDO $pdo, array $body, bool $creating): array
{
    $actor = mm_require_perm('users');
    $id = $creating ? mm_new_id('usr') : mm_id($body['id'] ?? '');
    $username = mm_text($body['username'] ?? '', 40, 'Username');
    if (!preg_match('/^[A-Za-z0-9._-]{3,40}$/', $username)) {
        throw new ApiException('Username must be 3–40 letters, numbers, dots or dashes.', 422);
    }
    $password = (string) ($body['password'] ?? '');
    if ($creating && strlen($password) < 6) {
        throw new ApiException('Password must be at least 6 characters.', 422);
    }
    if ($password !== '' && strlen($password) < 6) {
        throw new ApiException('Password must be at least 6 characters.', 422);
    }
    $roleId = mm_role_id(mm_text($body['role'] ?? '', 40, 'Role'));
    $active = array_key_exists('active', $body) ? (bool) $body['active'] : true;
    if ($id === $actor['id'] && !$active) {
        throw new ApiException('You cannot disable your own account.', 422);
    }
    $payload = [
        'id' => $id,
        'username' => $username,
        'full_name' => mm_text($body['fullName'] ?? '', 80, 'Full name'),
        'role' => $roleId,
        'email' => mm_text($body['email'] ?? '', 80, 'Email', false),
        'phone' => mm_text($body['phone'] ?? '', 40, 'Phone', false),
        'active' => $active ? 'true' : 'false',
    ];
    try {
        if ($creating) {
            $payload['hash'] = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare(
                'INSERT INTO users (id, username, password_hash, full_name, role_id, email, phone, active)
                 VALUES (:id, :username, :hash, :full_name, :role, :email, :phone, CAST(:active AS boolean))'
            );
            $stmt->execute($payload);
        } else {
            $sql = 'UPDATE users SET username = :username, full_name = :full_name, role_id = :role,
                    email = :email, phone = :phone, active = CAST(:active AS boolean), updated_at = now()';
            if ($password !== '') {
                $sql .= ', password_hash = :hash';
                $payload['hash'] = password_hash($password, PASSWORD_DEFAULT);
            }
            $sql .= ' WHERE id = :id';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($payload);
            $exists = $pdo->prepare('SELECT 1 FROM users WHERE id = :id');
            $exists->execute(['id' => $id]);
            if (!$exists->fetchColumn()) {
                throw new ApiException('User not found.', 404);
            }
        }
    } catch (PDOException $e) {
        if (mm_db_unique($e)) {
            throw new ApiException('Username already exists.', 422);
        }
        throw $e;
    }
    mm_audit($pdo, $actor['id'], $creating ? 'create' : 'update', 'user', $id);
    $row = mm_user_by_id($pdo, $id);
    return [
        'id' => $row['id'],
        'username' => $row['username'],
        'fullName' => $row['full_name'],
        'role' => $row['role_name'],
        'email' => $row['email'],
        'phone' => $row['phone'],
        'active' => mm_bool($row['active']),
    ];
}

function mm_delete_user(PDO $pdo, string $id): void
{
    $actor = mm_require_perm('users');
    $id = mm_id($id);
    if ($id === $actor['id']) {
        throw new ApiException('You cannot delete your own account.', 422);
    }
    try {
        $stmt = $pdo->prepare('DELETE FROM users WHERE id = :id');
        $stmt->execute(['id' => $id]);
    } catch (PDOException $e) {
        if (mm_db_fk($e)) {
            throw new ApiException('This user has sales, purchases or expenses. Disable the account instead.', 409);
        }
        throw $e;
    }
    if ($stmt->rowCount() === 0) {
        throw new ApiException('User not found.', 404);
    }
    mm_audit($pdo, $actor['id'], 'delete', 'user', $id);
}

function mm_change_password(PDO $pdo, array $body): void
{
    $user = mm_require_user();
    $current = (string) ($body['currentPassword'] ?? '');
    $next = (string) ($body['newPassword'] ?? '');
    if (strlen($next) < 6) {
        throw new ApiException('New password must be at least 6 characters.', 422);
    }
    $row = mm_user_by_id($pdo, $user['id']);
    if (!$row || !password_verify($current, $row['password_hash'])) {
        throw new ApiException('Current password is incorrect.', 422);
    }
    $stmt = $pdo->prepare('UPDATE users SET password_hash = :hash, updated_at = now() WHERE id = :id');
    $stmt->execute(['hash' => password_hash($next, PASSWORD_DEFAULT), 'id' => $user['id']]);
    mm_audit($pdo, $user['id'], 'password', 'user', $user['id']);
}

function mm_sales(PDO $pdo): array
{
    $sales = $pdo->query(
        'SELECT s.*, c.name AS customer_name, u.full_name AS cashier_name
         FROM sales s
         JOIN customers c ON c.id = s.customer_id
         JOIN users u ON u.id = s.cashier_id
         ORDER BY s.created_at DESC'
    )->fetchAll();
    if (!$sales) {
        return [];
    }
    $items = $pdo->query('SELECT * FROM sale_items')->fetchAll();
    $bySale = [];
    foreach ($items as $item) {
        $bySale[$item['sale_id']][] = [
            'productId' => $item['product_id'],
            'productName' => $item['product_name'],
            'qty' => (int) $item['qty'],
            'buyingPrice' => mm_num($item['buying_price']),
            'sellingPrice' => mm_num($item['selling_price']),
        ];
    }
    return array_map(static function (array $row) use ($bySale): array {
        return [
            'id' => $row['id'],
            'receiptNo' => $row['receipt_no'],
            'customerId' => $row['customer_id'],
            'customerName' => $row['customer_name'],
            'cashierId' => $row['cashier_id'],
            'cashierName' => $row['cashier_name'],
            'date' => mm_day($row['sale_date']),
            'createdAt' => mm_iso($row['created_at']),
            'paymentMethod' => $row['payment_method'],
            'amountPaid' => mm_num($row['amount_paid']),
            'change' => mm_num($row['change_amount']),
            'status' => $row['status'],
            'items' => $bySale[$row['id']] ?? [],
            'subtotal' => mm_num($row['subtotal']),
            'discount' => mm_num($row['discount_amount']),
            'taxRate' => (float) $row['tax_rate'],
            'taxAmount' => mm_num($row['tax_amount']),
            'total' => mm_num($row['total']),
        ];
    }, $sales);
}

function mm_purchases(PDO $pdo): array
{
    $rows = $pdo->query(
        'SELECT p.*, s.name AS supplier_name
         FROM purchases p
         JOIN suppliers s ON s.id = p.supplier_id
         ORDER BY p.created_at DESC'
    )->fetchAll();
    $items = $pdo->query('SELECT * FROM purchase_items')->fetchAll();
    $byPurchase = [];
    foreach ($items as $item) {
        $byPurchase[$item['purchase_id']][] = [
            'productId' => $item['product_id'],
            'productName' => $item['product_name'],
            'qty' => (int) $item['qty'],
            'buyingPrice' => mm_num($item['buying_price']),
        ];
    }
    return array_map(static function (array $row) use ($byPurchase): array {
        return [
            'id' => $row['id'],
            'purchaseNo' => $row['purchase_no'],
            'supplierId' => $row['supplier_id'],
            'supplierName' => $row['supplier_name'],
            'date' => mm_day($row['purchase_date']),
            'paymentMethod' => $row['payment_method'],
            'notes' => $row['notes'],
            'items' => $byPurchase[$row['id']] ?? [],
            'total' => mm_num($row['total']),
        ];
    }, $rows);
}

function mm_next_number(PDO $pdo, string $table, string $column, string $prefix, int $width, int $start): string
{
    if (!in_array($table, ['sales', 'purchases'], true) || !in_array($column, ['receipt_no', 'purchase_no'], true)) {
        throw new ApiException('Could not generate a document number.', 500);
    }
    $year = date('Y');
    $stmt = $pdo->prepare("SELECT {$column} FROM {$table} WHERE {$column} LIKE :prefix ORDER BY {$column} DESC LIMIT 1");
    $stmt->execute(['prefix' => $prefix . $year . '-%']);
    $last = $stmt->fetchColumn();
    $next = $start;
    if (is_string($last) && preg_match('/(\d+)$/', $last, $match)) {
        $next = max($start, ((int) $match[1]) + 1);
    }
    return $prefix . $year . '-' . str_pad((string) $next, $width, '0', STR_PAD_LEFT);
}

function mm_find_sale_request(PDO $pdo, string $requestId): ?array
{
    $stmt = $pdo->prepare('SELECT id FROM sales WHERE client_request_id = :id');
    $stmt->execute(['id' => $requestId]);
    $id = $stmt->fetchColumn();
    if (!$id) {
        return null;
    }
    foreach (mm_sales($pdo) as $sale) {
        if ($sale['id'] === $id) {
            return $sale;
        }
    }
    return null;
}

function mm_create_sale(PDO $pdo, array $body): array
{
    $user = mm_require_perm('sales');
    $requestId = mm_request_id($body['clientRequestId'] ?? null);
    if ($requestId) {
        $existing = mm_find_sale_request($pdo, $requestId);
        if ($existing) {
            return ['sale' => $existing, 'products' => mm_products($pdo), 'replayed' => true];
        }
    }
    $lines = $body['items'] ?? null;
    if (!is_array($lines) || !$lines) {
        throw new ApiException('Add at least one product.', 422);
    }
    $customerId = mm_id($body['customerId'] ?? 'cust_walkin');
    $method = mm_payment($body['paymentMethod'] ?? '');
    $discount = mm_money($body['discount'] ?? 0, 'Discount');
    $customer = $pdo->prepare('SELECT id, name FROM customers WHERE id = :id');
    $customer->execute(['id' => $customerId]);
    $customerRow = $customer->fetch();
    if (!$customerRow) {
        throw new ApiException('Customer not found.', 422);
    }

    $merged = [];
    foreach ($lines as $line) {
        if (!is_array($line)) {
            throw new ApiException('Invalid sale line.', 422);
        }
        $productId = mm_id($line['productId'] ?? '');
        $qty = mm_qty($line['qty'] ?? 0);
        $merged[$productId] = ($merged[$productId] ?? 0) + $qty;
    }

    $pdo->beginTransaction();
    try {
        $placeholders = implode(',', array_fill(0, count($merged), '?'));
        $lock = $pdo->prepare("SELECT * FROM products WHERE id IN ($placeholders) FOR UPDATE");
        $lock->execute(array_keys($merged));
        $products = [];
        foreach ($lock->fetchAll() as $product) {
            $products[$product['id']] = $product;
        }
        if (count($products) !== count($merged)) {
            throw new ApiException('One or more products are no longer available.', 422);
        }

        $subtotal = 0.0;
        $prepared = [];
        foreach ($merged as $productId => $qty) {
            $product = $products[$productId];
            if ((int) $product['stock'] < $qty) {
                throw new ApiException('Insufficient stock for ' . $product['name'] . '.', 422);
            }
            $selling = mm_num($product['selling_price']);
            $subtotal += $selling * $qty;
            $prepared[] = [
                'productId' => $productId,
                'name' => $product['name'],
                'qty' => $qty,
                'buying' => mm_money($product['buying_price'], 'Buying price'),
                'selling' => number_format($selling, 2, '.', ''),
            ];
        }
        $subtotal = round($subtotal, 2);
        if ((float) $discount > $subtotal) {
            throw new ApiException('Discount cannot exceed the subtotal.', 422);
        }
        $taxRate = (float) mm_setting($pdo, 'tax_rate', '0');
        $taxable = round($subtotal - (float) $discount, 2);
        $taxAmount = round($taxable * $taxRate / 100, 2);
        $total = round($taxable + $taxAmount, 2);
        $paid = mm_money($body['amountPaid'] ?? null, 'Amount paid');
        if ((float) $paid < $total) {
            throw new ApiException('Amount paid is less than the total.', 422);
        }
        $change = number_format((float) $paid - $total, 2, '.', '');
        $saleId = mm_new_id('sale');
        $receipt = mm_next_number($pdo, 'sales', 'receipt_no', 'RCP-', 4, 1001);
        $insert = $pdo->prepare(
            'INSERT INTO sales (
                id, receipt_no, customer_id, cashier_id, sale_date, payment_method, amount_paid,
                change_amount, status, subtotal, discount_amount, tax_rate, tax_amount, total,
                stock_applied, client_request_id
             ) VALUES (
                :id, :receipt, :customer, :cashier, CURRENT_DATE, :method, :paid,
                :change, \'completed\', :subtotal, :discount, :tax_rate, :tax, :total,
                TRUE, :request
             )'
        );
        $insert->execute([
            'id' => $saleId,
            'receipt' => $receipt,
            'customer' => $customerId,
            'cashier' => $user['id'],
            'method' => $method,
            'paid' => $paid,
            'change' => $change,
            'subtotal' => number_format($subtotal, 2, '.', ''),
            'discount' => $discount,
            'tax_rate' => number_format($taxRate, 4, '.', ''),
            'tax' => number_format($taxAmount, 2, '.', ''),
            'total' => number_format($total, 2, '.', ''),
            'request' => $requestId,
        ]);
        $itemStmt = $pdo->prepare(
            'INSERT INTO sale_items (id, sale_id, product_id, product_name, qty, buying_price, selling_price)
             VALUES (:id, :sale, :product, :name, :qty, :buying, :selling)'
        );
        $stockStmt = $pdo->prepare(
            'UPDATE products SET stock = stock - :qty, updated_at = now()
             WHERE id = :id AND stock >= :qty'
        );
        foreach ($prepared as $line) {
            $itemStmt->execute([
                'id' => mm_new_id('si'),
                'sale' => $saleId,
                'product' => $line['productId'],
                'name' => $line['name'],
                'qty' => $line['qty'],
                'buying' => $line['buying'],
                'selling' => $line['selling'],
            ]);
            $stockStmt->execute(['qty' => $line['qty'], 'id' => $line['productId']]);
            if ($stockStmt->rowCount() !== 1) {
                throw new ApiException('Insufficient stock for ' . $line['name'] . '.', 422);
            }
        }
        $pay = $pdo->prepare(
            'INSERT INTO payments (id, reference_type, reference_id, amount, method)
             VALUES (:id, \'sale\', :ref, :amount, :method)'
        );
        $pay->execute([
            'id' => mm_new_id('pay'),
            'ref' => $saleId,
            'amount' => number_format($total, 2, '.', ''),
            'method' => $method,
        ]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if ($e instanceof PDOException && mm_db_unique($e) && $requestId) {
            $existing = mm_find_sale_request($pdo, $requestId);
            if ($existing) {
                return ['sale' => $existing, 'products' => mm_products($pdo), 'replayed' => true];
            }
        }
        throw $e;
    }
    mm_audit($pdo, $user['id'], 'create', 'sale', $saleId);
    $sale = mm_find_sale_request($pdo, (string) $requestId);
    if (!$sale) {
        foreach (mm_sales($pdo) as $row) {
            if ($row['id'] === $saleId) {
                $sale = $row;
                break;
            }
        }
    }
    return ['sale' => $sale, 'products' => mm_products($pdo), 'replayed' => false];
}

function mm_create_purchase(PDO $pdo, array $body): array
{
    $user = mm_require_perm('purchases');
    $requestId = mm_request_id($body['clientRequestId'] ?? null);
    if ($requestId) {
        $existingId = $pdo->prepare('SELECT id FROM purchases WHERE client_request_id = :id');
        $existingId->execute(['id' => $requestId]);
        $found = $existingId->fetchColumn();
        if ($found) {
            foreach (mm_purchases($pdo) as $purchase) {
                if ($purchase['id'] === $found) {
                    return ['purchase' => $purchase, 'products' => mm_products($pdo), 'replayed' => true];
                }
            }
        }
    }
    $supplierId = mm_id($body['supplierId'] ?? '');
    $supplier = $pdo->prepare('SELECT id, name FROM suppliers WHERE id = :id');
    $supplier->execute(['id' => $supplierId]);
    if (!$supplier->fetch()) {
        throw new ApiException('Select a supplier.', 422);
    }
    $lines = $body['items'] ?? null;
    if (!is_array($lines) || !$lines) {
        throw new ApiException('Add at least one purchase line.', 422);
    }
    $merged = [];
    foreach ($lines as $line) {
        if (!is_array($line)) {
            throw new ApiException('Invalid purchase line.', 422);
        }
        $productId = mm_id($line['productId'] ?? '');
        $qty = mm_qty($line['qty'] ?? 0);
        $price = mm_money($line['buyingPrice'] ?? null, 'Buying price', false);
        if (isset($merged[$productId])) {
            $merged[$productId]['qty'] += $qty;
            $merged[$productId]['price'] = $price;
        } else {
            $merged[$productId] = ['qty' => $qty, 'price' => $price];
        }
    }

    $pdo->beginTransaction();
    try {
        $placeholders = implode(',', array_fill(0, count($merged), '?'));
        $lock = $pdo->prepare("SELECT id, name FROM products WHERE id IN ($placeholders) FOR UPDATE");
        $lock->execute(array_keys($merged));
        $names = [];
        foreach ($lock->fetchAll() as $product) {
            $names[$product['id']] = $product['name'];
        }
        if (count($names) !== count($merged)) {
            throw new ApiException('One or more products are no longer available.', 422);
        }
        $total = 0.0;
        foreach ($merged as $line) {
            $total += (float) $line['price'] * $line['qty'];
        }
        $total = round($total, 2);
        $purchaseId = mm_new_id('pur');
        $number = mm_next_number($pdo, 'purchases', 'purchase_no', 'PO-', 3, 1);
        $insert = $pdo->prepare(
            'INSERT INTO purchases
             (id, purchase_no, supplier_id, received_by, purchase_date, payment_method, notes, total, stock_applied, client_request_id)
             VALUES (:id, :number, :supplier, :user, :date, :method, :notes, :total, TRUE, :request)'
        );
        $insert->execute([
            'id' => $purchaseId,
            'number' => $number,
            'supplier' => $supplierId,
            'user' => $user['id'],
            'date' => mm_date_input($body['date'] ?? date('Y-m-d')),
            'method' => mm_payment($body['paymentMethod'] ?? ''),
            'notes' => mm_text($body['notes'] ?? '', 240, 'Notes', false),
            'total' => number_format($total, 2, '.', ''),
            'request' => $requestId,
        ]);
        $itemStmt = $pdo->prepare(
            'INSERT INTO purchase_items (id, purchase_id, product_id, product_name, qty, buying_price)
             VALUES (:id, :purchase, :product, :name, :qty, :price)'
        );
        $stockStmt = $pdo->prepare(
            'UPDATE products SET stock = stock + :qty, buying_price = :price, updated_at = now() WHERE id = :id'
        );
        foreach ($merged as $productId => $line) {
            $itemStmt->execute([
                'id' => mm_new_id('pi'),
                'purchase' => $purchaseId,
                'product' => $productId,
                'name' => $names[$productId],
                'qty' => $line['qty'],
                'price' => $line['price'],
            ]);
            $stockStmt->execute(['qty' => $line['qty'], 'price' => $line['price'], 'id' => $productId]);
        }
        $pay = $pdo->prepare(
            'INSERT INTO payments (id, reference_type, reference_id, amount, method)
             VALUES (:id, \'purchase\', :ref, :amount, :method)'
        );
        $pay->execute([
            'id' => mm_new_id('pay'),
            'ref' => $purchaseId,
            'amount' => number_format($total, 2, '.', ''),
            'method' => mm_payment($body['paymentMethod'] ?? ''),
        ]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if ($e instanceof PDOException && mm_db_unique($e) && $requestId) {
            $existingId = $pdo->prepare('SELECT id FROM purchases WHERE client_request_id = :id');
            $existingId->execute(['id' => $requestId]);
            $found = $existingId->fetchColumn();
            if ($found) {
                foreach (mm_purchases($pdo) as $purchase) {
                    if ($purchase['id'] === $found) {
                        return ['purchase' => $purchase, 'products' => mm_products($pdo), 'replayed' => true];
                    }
                }
            }
        }
        throw $e;
    }
    mm_audit($pdo, $user['id'], 'create', 'purchase', $purchaseId);
    $saved = null;
    foreach (mm_purchases($pdo) as $purchase) {
        if ($purchase['id'] === $purchaseId) {
            $saved = $purchase;
            break;
        }
    }
    return ['purchase' => $saved, 'products' => mm_products($pdo), 'replayed' => false];
}

function mm_workspace(PDO $pdo): array
{
    $user = mm_require_user();
    $data = [
        'user' => $user,
        'settings' => mm_settings($pdo),
        'products' => [],
        'suppliers' => [],
        'customers' => [],
        'sales' => [],
        'purchases' => [],
        'expenses' => [],
        'users' => [],
    ];
    if (mm_can_read($user, 'products')) {
        $data['products'] = mm_products($pdo);
        if (!mm_can_view_costs($user)) {
            $data['products'] = array_map(static function (array $product): array {
                unset($product['buyingPrice']);
                return $product;
            }, $data['products']);
        }
    }
    if (mm_can_read($user, 'suppliers')) {
        $data['suppliers'] = mm_suppliers($pdo);
    }
    if (mm_can_read($user, 'customers')) {
        $data['customers'] = mm_customers($pdo);
    }
    if (mm_can_read($user, 'sales')) {
        $data['sales'] = mm_sales($pdo);
        if (!mm_can_view_costs($user)) {
            $data['sales'] = array_map(static function (array $sale): array {
                $sale['items'] = array_map(static function (array $item): array {
                    unset($item['buyingPrice']);
                    return $item;
                }, $sale['items']);
                return $sale;
            }, $data['sales']);
        }
    }
    if (mm_can_read($user, 'purchases')) {
        $data['purchases'] = mm_purchases($pdo);
    }
    if (mm_can_read($user, 'expenses')) {
        $data['expenses'] = mm_expenses($pdo);
    }
    if (mm_can($user, 'users')) {
        $data['users'] = mm_users($pdo);
    }
    return $data;
}

function mm_report_summary(PDO $pdo, ?string $from, ?string $to): array
{
    $user = mm_require_user();
    if (!mm_can($user, 'reports') && !mm_can($user, 'accounting')) {
        throw new ApiException('You do not have permission to view reports.', 403);
    }
    $fromDate = $from ? mm_date_input($from) : '1900-01-01';
    $toDate = $to ? mm_date_input($to) : '2999-12-31';
    $sales = $pdo->prepare(
        'SELECT COALESCE(SUM(line_revenue), 0) AS revenue,
                COALESCE(SUM(line_cogs), 0) AS cogs,
                COUNT(*) AS sales_count
         FROM (
            SELECT s.id,
                   SUM(si.qty * si.selling_price) - MAX(s.discount_amount) AS line_revenue,
                   SUM(si.qty * si.buying_price) AS line_cogs
            FROM sales s
            JOIN sale_items si ON si.sale_id = s.id
            WHERE s.status = \'completed\' AND s.sale_date BETWEEN :from AND :to
            GROUP BY s.id
         ) lines'
    );
    $sales->execute(['from' => $fromDate, 'to' => $toDate]);
    $saleRow = $sales->fetch();
    $purchases = $pdo->prepare(
        'SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS count
         FROM purchases WHERE purchase_date BETWEEN :from AND :to'
    );
    $purchases->execute(['from' => $fromDate, 'to' => $toDate]);
    $purchaseRow = $purchases->fetch();
    $expenses = $pdo->prepare(
        'SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
         FROM expenses WHERE expense_date BETWEEN :from AND :to'
    );
    $expenses->execute(['from' => $fromDate, 'to' => $toDate]);
    $expenseRow = $expenses->fetch();
    $stock = $pdo->query(
        'SELECT COALESCE(SUM(stock * buying_price), 0) AS cost,
                COALESCE(SUM(stock * selling_price), 0) AS retail,
                COUNT(*) AS products,
                COUNT(*) FILTER (WHERE stock > 0 AND stock <= min_stock) AS low_stock,
                COUNT(*) FILTER (WHERE stock <= 0) AS out_stock
         FROM products'
    )->fetch();
    $revenue = mm_num($saleRow['revenue']);
    $cogs = mm_num($saleRow['cogs']);
    $expenseTotal = mm_num($expenseRow['total']);
    $gross = round($revenue - $cogs, 2);
    return [
        'revenue' => $revenue,
        'cogs' => $cogs,
        'grossProfit' => $gross,
        'operatingExpenses' => $expenseTotal,
        'netProfit' => round($gross - $expenseTotal, 2),
        'purchaseTotal' => mm_num($purchaseRow['total']),
        'salesCount' => (int) $saleRow['sales_count'],
        'purchaseCount' => (int) $purchaseRow['count'],
        'expenseCount' => (int) $expenseRow['count'],
        'inventoryValueCost' => mm_num($stock['cost']),
        'inventoryValueRetail' => mm_num($stock['retail']),
        'closingStock' => mm_num($stock['cost']),
        'productCount' => (int) $stock['products'],
        'lowStockCount' => (int) $stock['low_stock'],
        'outOfStockCount' => (int) $stock['out_stock'],
    ];
}

function mm_seed_demo(PDO $pdo): void
{
    $user = mm_require_perm('settings');
    $path = dirname(__DIR__, 2) . '/database/seed_data.sql';
    $sql = file_get_contents($path);
    if ($sql === false) {
        throw new ApiException('Demonstration data file is missing.', 500);
    }
    $pdo->beginTransaction();
    try {
        mm_exec_script($pdo, $sql);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        mm_log('Seed failed: ' . $e->getMessage());
        throw new ApiException('Could not restore demonstration data.', 500);
    }
    mm_audit($pdo, $user['id'], 'seed', 'database', 'demo');
}

function mm_legacy_rows(array $data, string $key): array
{
    $rows = $data[$key] ?? [];
    if (!is_array($rows) || !array_is_list($rows) || count($rows) > 5000) {
        throw new ApiException('Legacy ' . $key . ' data must be a list of at most 5,000 records.', 422);
    }
    foreach ($rows as $row) {
        if (!is_array($row)) {
            throw new ApiException('Legacy ' . $key . ' contains an invalid record.', 422);
        }
    }
    return $rows;
}

function mm_import_legacy_data(PDO $pdo, array $data): array
{
    $actor = mm_require_perm('settings');
    if (($data['format'] ?? '') !== 'minimart-localstorage-v1') {
        throw new ApiException('Unsupported legacy data file. Export data from the earlier MiniMart version first.', 422);
    }

    $suppliers = mm_legacy_rows($data, 'suppliers');
    $customers = mm_legacy_rows($data, 'customers');
    $products = mm_legacy_rows($data, 'products');
    $sales = mm_legacy_rows($data, 'sales');
    $purchases = mm_legacy_rows($data, 'purchases');
    $expenses = mm_legacy_rows($data, 'expenses');
    $productIds = [];
    $supplierIds = [];
    $customerIds = [];
    $counts = ['suppliers' => 0, 'customers' => 0, 'products' => 0, 'sales' => 0, 'purchases' => 0, 'expenses' => 0];

    $pdo->beginTransaction();
    try {
        $walkInLookup = $pdo->query('SELECT id FROM customers WHERE is_walk_in = TRUE LIMIT 1');
        $walkInCustomerId = $walkInLookup->fetchColumn();
        if (!$walkInCustomerId) {
            $pdo->prepare(
                'INSERT INTO customers (id, name, phone, email, address, is_walk_in)
                 VALUES (\'cust_walkin\', \'Walk-in Customer\', \'N/A\', \'\', \'\', TRUE)
                 ON CONFLICT (id) DO NOTHING'
            )->execute();
            $walkInLookup = $pdo->query('SELECT id FROM customers WHERE is_walk_in = TRUE LIMIT 1');
            $walkInCustomerId = $walkInLookup->fetchColumn();
            if (!$walkInCustomerId) {
                throw new ApiException('Could not locate or create the walk-in customer.', 500);
            }
        }

        foreach ($suppliers as $row) {
            $oldId = mm_id($row['id'] ?? '');
            $values = [
                'name' => mm_text($row['name'] ?? '', 80, 'Supplier name'),
                'phone' => mm_text($row['phone'] ?? '', 40, 'Phone', false),
                'email' => mm_text($row['email'] ?? '', 80, 'Email', false),
                'address' => mm_text($row['address'] ?? '', 160, 'Address', false),
                'notes' => mm_text($row['notes'] ?? '', 240, 'Notes', false),
            ];
            $matching = $pdo->prepare(
                'SELECT id FROM suppliers
                 WHERE lower(name) = lower(:name) AND phone = :phone AND email = :email LIMIT 1'
            );
            $matching->execute(['name' => $values['name'], 'phone' => $values['phone'], 'email' => $values['email']]);
            $matchedId = $matching->fetchColumn();
            if ($matchedId) {
                $supplierIds[$oldId] = (string) $matchedId;
                continue;
            }
            $id = $oldId;
            $idCheck = $pdo->prepare('SELECT 1 FROM suppliers WHERE id = :id');
            $idCheck->execute(['id' => $id]);
            if ($idCheck->fetchColumn()) {
                $id = mm_new_id('sup');
            }
            $stmt = $pdo->prepare(
                'INSERT INTO suppliers (id, name, phone, email, address, notes)
                 VALUES (:id, :name, :phone, :email, :address, :notes)'
            );
            $stmt->execute(['id' => $id] + $values);
            $supplierIds[$oldId] = $id;
            $counts['suppliers']++;
        }

        foreach ($customers as $row) {
            $oldId = mm_id($row['id'] ?? '');
            $walkIn = mm_bool($row['isWalkIn'] ?? false);
            if ($walkIn) {
                $customerIds[$oldId] = (string) $walkInCustomerId;
                continue;
            }
            $values = [
                'name' => mm_text($row['name'] ?? '', 80, 'Customer name'),
                'phone' => mm_text($row['phone'] ?? '', 40, 'Phone', false),
                'email' => mm_text($row['email'] ?? '', 80, 'Email', false),
                'address' => mm_text($row['address'] ?? '', 160, 'Address', false),
            ];
            $matching = $pdo->prepare(
                'SELECT id FROM customers
                 WHERE is_walk_in = FALSE AND lower(name) = lower(:name)
                   AND phone = :phone AND email = :email LIMIT 1'
            );
            $matching->execute(['name' => $values['name'], 'phone' => $values['phone'], 'email' => $values['email']]);
            $matchedId = $matching->fetchColumn();
            if ($matchedId) {
                $customerIds[$oldId] = (string) $matchedId;
                continue;
            }
            $id = $oldId;
            $idCheck = $pdo->prepare('SELECT 1 FROM customers WHERE id = :id');
            $idCheck->execute(['id' => $id]);
            if ($idCheck->fetchColumn()) {
                $id = mm_new_id('cust');
            }
            $stmt = $pdo->prepare(
                'INSERT INTO customers (id, name, phone, email, address, is_walk_in)
                 VALUES (:id, :name, :phone, :email, :address, FALSE)'
            );
            $stmt->execute(['id' => $id] + $values);
            $customerIds[$oldId] = $id;
            $counts['customers']++;
        }

        foreach ($products as $row) {
            $oldId = mm_id($row['id'] ?? '');
            $code = mm_text($row['code'] ?? '', 30, 'Product code');
            $existing = $pdo->prepare('SELECT id FROM products WHERE lower(code) = lower(:code)');
            $existing->execute(['code' => $code]);
            $found = $existing->fetchColumn();
            if ($found) {
                $productIds[$oldId] = (string) $found;
                continue;
            }
            $existing = $pdo->prepare('SELECT id, code FROM products WHERE id = :id');
            $existing->execute(['id' => $oldId]);
            $sameId = $existing->fetch();
            if ($sameId) {
                $oldId = mm_new_id('prd');
            }
            $buying = mm_money($row['buyingPrice'] ?? null, 'Buying price');
            $selling = mm_money($row['sellingPrice'] ?? null, 'Selling price');
            if ((float) $selling < (float) $buying) {
                throw new ApiException('Selling price cannot be below buying price during migration.', 422);
            }
            $categoryId = mm_category_id($pdo, (string) ($row['category'] ?? ''));
            $stmt = $pdo->prepare(
                'INSERT INTO products (id, code, name, category_id, buying_price, selling_price, stock, min_stock, unit)
                 VALUES (:id, :code, :name, :category, :buying, :selling, :stock, :min_stock, :unit)'
            );
            $stmt->execute([
                'id' => $oldId,
                'code' => $code,
                'name' => mm_text($row['name'] ?? '', 80, 'Product name'),
                'category' => $categoryId,
                'buying' => $buying,
                'selling' => $selling,
                'stock' => mm_qty($row['stock'] ?? 0, true),
                'min_stock' => mm_qty($row['minStock'] ?? 0, true),
                'unit' => mm_text($row['unit'] ?? 'unit', 30, 'Unit', false) ?: 'unit',
            ]);
            $productIds[(string) ($row['id'] ?? '')] = $oldId;
            $counts['products']++;
        }

        foreach ($sales as $row) {
            if (isset($row['status']) && $row['status'] !== 'completed') {
                throw new ApiException('Only completed legacy sales can be migrated.', 422);
            }
            $id = mm_id($row['id'] ?? '');
            $receiptValue = $row['receiptNo'] ?? '';
            $receipt = mm_text($receiptValue !== '' ? $receiptValue : ('LEGACY-RCP-' . $id), 80, 'Receipt number');
            $exists = $pdo->prepare('SELECT 1 FROM sales WHERE id = :id OR receipt_no = :receipt LIMIT 1');
            $exists->execute(['id' => $id, 'receipt' => $receipt]);
            if ($exists->fetchColumn()) {
                continue;
            }
            $customerId = $customerIds[(string) ($row['customerId'] ?? '')] ?? (string) ($row['customerId'] ?? $walkInCustomerId);
            $customerCheck = $pdo->prepare('SELECT 1 FROM customers WHERE id = :id');
            $customerCheck->execute(['id' => $customerId]);
            if (!$customerCheck->fetchColumn()) {
                $customerId = (string) $walkInCustomerId;
            }
            $cashierId = (string) ($row['cashierId'] ?? $actor['id']);
            $userCheck = $pdo->prepare('SELECT 1 FROM users WHERE id = :id');
            $userCheck->execute(['id' => $cashierId]);
            if (!$userCheck->fetchColumn()) {
                $cashierId = $actor['id'];
            }
            $items = $row['items'] ?? [];
            if (!is_array($items) || !$items) {
                throw new ApiException('A legacy sale is missing its item list.', 422);
            }
            $subtotal = 0.0;
            $itemRows = [];
            foreach ($items as $item) {
                if (!is_array($item)) {
                    throw new ApiException('A legacy sale contains an invalid item.', 422);
                }
                $oldProductId = (string) ($item['productId'] ?? '');
                $productId = $productIds[$oldProductId] ?? $oldProductId;
                $product = $pdo->prepare('SELECT id, name FROM products WHERE id = :id');
                $product->execute(['id' => $productId]);
                $productRow = $product->fetch();
                if (!$productRow) {
                    throw new ApiException('A legacy sale references a product that was not imported.', 422);
                }
                $qty = mm_qty($item['qty'] ?? 0);
                $buying = mm_money($item['buyingPrice'] ?? null, 'Buying price');
                $selling = mm_money($item['sellingPrice'] ?? null, 'Selling price');
                $subtotal += (float) $selling * $qty;
                $itemRows[] = [$productRow['id'], mm_text($item['productName'] ?? $productRow['name'], 80, 'Product name'), $qty, $buying, $selling];
            }
            $subtotal = round($subtotal, 2);
            $discount = mm_money($row['discount'] ?? 0, 'Discount');
            $taxRate = mm_money($row['taxRate'] ?? 0, 'Tax rate');
            $tax = mm_money($row['taxAmount'] ?? (max(0, $subtotal - (float) $discount) * (float) $taxRate / 100), 'Tax amount');
            $total = mm_money($row['total'] ?? (max(0, $subtotal - (float) $discount) + (float) $tax), 'Sale total');
            $method = mm_payment($row['paymentMethod'] ?? 'Cash');
            $paid = mm_money($row['amountPaid'] ?? $total, 'Amount paid');
            $change = mm_money($row['change'] ?? max(0, (float) $paid - (float) $total), 'Change');
            $stmt = $pdo->prepare(
                'INSERT INTO sales (id, receipt_no, customer_id, cashier_id, sale_date, payment_method, amount_paid,
                 change_amount, status, subtotal, discount_amount, tax_rate, tax_amount, total, stock_applied)
                 VALUES (:id, :receipt, :customer, :cashier, :date, :method, :paid, :change,
                 \'completed\', :subtotal, :discount, :tax_rate, :tax, :total, TRUE)'
            );
            $stmt->execute([
                'id' => $id, 'receipt' => $receipt, 'customer' => $customerId, 'cashier' => $cashierId,
                'date' => mm_date_input($row['date'] ?? date('Y-m-d')), 'method' => $method, 'paid' => $paid,
                'change' => $change, 'subtotal' => number_format($subtotal, 2, '.', ''), 'discount' => $discount,
                'tax_rate' => $taxRate, 'tax' => $tax, 'total' => $total,
            ]);
            $itemInsert = $pdo->prepare(
                'INSERT INTO sale_items (id, sale_id, product_id, product_name, qty, buying_price, selling_price)
                 VALUES (:id, :sale, :product, :name, :qty, :buying, :selling)'
            );
            foreach ($itemRows as [$productId, $name, $qty, $buying, $selling]) {
                $itemInsert->execute([
                    'id' => mm_new_id('si'), 'sale' => $id, 'product' => $productId,
                    'name' => $name, 'qty' => $qty, 'buying' => $buying, 'selling' => $selling,
                ]);
            }
            $payment = $pdo->prepare(
                'INSERT INTO payments (id, reference_type, reference_id, amount, method)
                 VALUES (:id, \'sale\', :reference, :amount, :method) ON CONFLICT (reference_type, reference_id) DO NOTHING'
            );
            $payment->execute(['id' => mm_new_id('pay'), 'reference' => $id, 'amount' => $total, 'method' => $method]);
            $counts['sales']++;
        }

        foreach ($purchases as $row) {
            $id = mm_id($row['id'] ?? '');
            $numberValue = $row['purchaseNo'] ?? '';
            $number = mm_text($numberValue !== '' ? $numberValue : ('LEGACY-PO-' . $id), 80, 'Purchase reference');
            $exists = $pdo->prepare('SELECT 1 FROM purchases WHERE id = :id OR purchase_no = :number LIMIT 1');
            $exists->execute(['id' => $id, 'number' => $number]);
            if ($exists->fetchColumn()) {
                continue;
            }
            $supplierId = $supplierIds[(string) ($row['supplierId'] ?? '')] ?? (string) ($row['supplierId'] ?? '');
            $supplierCheck = $pdo->prepare('SELECT 1 FROM suppliers WHERE id = :id');
            $supplierCheck->execute(['id' => $supplierId]);
            if (!$supplierCheck->fetchColumn()) {
                throw new ApiException('A legacy purchase references a supplier that was not imported.', 422);
            }
            $items = $row['items'] ?? [];
            if (!is_array($items) || !$items) {
                throw new ApiException('A legacy purchase is missing its item list.', 422);
            }
            $total = 0.0;
            $itemRows = [];
            foreach ($items as $item) {
                if (!is_array($item)) {
                    throw new ApiException('A legacy purchase contains an invalid item.', 422);
                }
                $oldProductId = (string) ($item['productId'] ?? '');
                $productId = $productIds[$oldProductId] ?? $oldProductId;
                $product = $pdo->prepare('SELECT id, name FROM products WHERE id = :id');
                $product->execute(['id' => $productId]);
                $productRow = $product->fetch();
                if (!$productRow) {
                    throw new ApiException('A legacy purchase references a product that was not imported.', 422);
                }
                $qty = mm_qty($item['qty'] ?? 0);
                $price = mm_money($item['buyingPrice'] ?? null, 'Buying price');
                $total += (float) $price * $qty;
                $itemRows[] = [$productRow['id'], mm_text($item['productName'] ?? $productRow['name'], 80, 'Product name'), $qty, $price];
            }
            $total = mm_money($row['total'] ?? $total, 'Purchase total');
            $method = mm_payment($row['paymentMethod'] ?? 'Cash');
            $stmt = $pdo->prepare(
                'INSERT INTO purchases (id, purchase_no, supplier_id, received_by, purchase_date, payment_method, notes, total, stock_applied)
                 VALUES (:id, :number, :supplier, :user, :date, :method, :notes, :total, TRUE)'
            );
            $stmt->execute([
                'id' => $id, 'number' => $number, 'supplier' => $supplierId, 'user' => $actor['id'],
                'date' => mm_date_input($row['date'] ?? date('Y-m-d')), 'method' => $method,
                'notes' => mm_text($row['notes'] ?? '', 240, 'Notes', false), 'total' => $total,
            ]);
            $itemInsert = $pdo->prepare(
                'INSERT INTO purchase_items (id, purchase_id, product_id, product_name, qty, buying_price)
                 VALUES (:id, :purchase, :product, :name, :qty, :price)'
            );
            foreach ($itemRows as [$productId, $name, $qty, $price]) {
                $itemInsert->execute([
                    'id' => mm_new_id('pi'), 'purchase' => $id, 'product' => $productId,
                    'name' => $name, 'qty' => $qty, 'price' => $price,
                ]);
            }
            $payment = $pdo->prepare(
                'INSERT INTO payments (id, reference_type, reference_id, amount, method)
                 VALUES (:id, \'purchase\', :reference, :amount, :method) ON CONFLICT (reference_type, reference_id) DO NOTHING'
            );
            $payment->execute(['id' => mm_new_id('pay'), 'reference' => $id, 'amount' => $total, 'method' => $method]);
            $counts['purchases']++;
        }

        foreach ($expenses as $row) {
            $id = mm_id($row['id'] ?? '');
            $exists = $pdo->prepare('SELECT 1 FROM expenses WHERE id = :id');
            $exists->execute(['id' => $id]);
            if ($exists->fetchColumn()) {
                continue;
            }
            $category = mm_text($row['category'] ?? '', 60, 'Expense category');
            $pdo->prepare('INSERT INTO expense_categories (name) VALUES (:name) ON CONFLICT (name) DO NOTHING')
                ->execute(['name' => $category]);
            $amount = mm_money($row['amount'] ?? null, 'Expense amount', false);
            $method = mm_payment($row['paymentMethod'] ?? 'Cash');
            $stmt = $pdo->prepare(
                'INSERT INTO expenses (id, description, category, amount, expense_date, payment_method, created_by)
                 VALUES (:id, :description, :category, :amount, :date, :method, :user)'
            );
            $stmt->execute([
                'id' => $id, 'description' => mm_text($row['description'] ?? '', 160, 'Expense description'),
                'category' => $category, 'amount' => $amount,
                'date' => mm_date_input($row['date'] ?? date('Y-m-d')), 'method' => $method, 'user' => $actor['id'],
            ]);
            $pdo->prepare(
                'INSERT INTO payments (id, reference_type, reference_id, amount, method)
                 VALUES (:id, \'expense\', :reference, :amount, :method) ON CONFLICT (reference_type, reference_id) DO NOTHING'
            )->execute(['id' => mm_new_id('pay'), 'reference' => $id, 'amount' => $amount, 'method' => $method]);
            $counts['expenses']++;
        }

        if (isset($data['settings']) && is_array($data['settings'])) {
            mm_save_settings($pdo, $data['settings']);
        }
        mm_audit($pdo, $actor['id'], 'import', 'legacy_data', 'browser_export', $counts);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    return $counts;
}
