<?php
declare(strict_types=1);

function mm_dispatch(): void
{
    $resource = preg_replace('/[^a-z]/', '', strtolower((string) ($_GET['r'] ?? ''))) ?? '';
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if ($method === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
    $id = (string) ($_GET['id'] ?? '');
    $mutating = in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true);

    if ($resource === 'health' && $method === 'GET') {
        mm_db();
        mm_ok(['database' => 'connected']);
    }
    if ($resource === 'login' && $method === 'POST') {
        $body = mm_body();
        $user = mm_login(
            mm_db(),
            (string) ($body['username'] ?? ''),
            (string) ($body['password'] ?? ''),
            !empty($body['remember'])
        );
        mm_ok(['user' => $user]);
    }

    if ($mutating && $resource !== 'login') {
        mm_require_csrf();
    }

    $pdo = mm_db();
    if ($resource === 'logout' && $method === 'POST') {
        mm_logout($pdo);
        mm_json(['ok' => true]);
    }
    if ($resource === 'session' && $method === 'GET') {
        mm_ok(['user' => mm_current_user()]);
    }
    if ($resource === 'workspace' && $method === 'GET') {
        mm_ok(mm_workspace($pdo));
    }
    if ($resource === 'reports' && $method === 'GET') {
        $summary = mm_report_summary(
            $pdo,
            isset($_GET['from']) ? (string) $_GET['from'] : null,
            isset($_GET['to']) ? (string) $_GET['to'] : null
        );
        mm_ok(['summary' => $summary]);
    }
    if ($resource === 'password' && $method === 'POST') {
        mm_change_password($pdo, mm_body());
        mm_ok(['message' => 'Password updated successfully.']);
    }
    if ($resource === 'settings' && $method === 'PUT') {
        mm_ok(['settings' => mm_save_settings($pdo, mm_body())]);
    }
    if ($resource === 'seed' && $method === 'POST') {
        mm_seed_demo($pdo);
        mm_ok(['message' => 'Demonstration data restored.']);
    }
    if ($resource === 'migration' && $method === 'POST') {
        mm_ok(['result' => mm_import_legacy_data($pdo, mm_body())]);
    }
    if ($resource === 'sales' && $method === 'POST') {
        $result = mm_create_sale($pdo, mm_body());
        $user = mm_current_user();
        $sale = $result['sale'];
        $products = $result['products'];
        if (!is_array($sale)) {
            throw new ApiException('The sale was saved, but its receipt could not be loaded. Check sales history before retrying.', 500);
        }
        if ($user && !mm_can_view_costs($user)) {
            foreach ($sale['items'] as &$item) {
                unset($item['buyingPrice']);
            }
            unset($item);
            foreach ($products as &$product) {
                unset($product['buyingPrice']);
            }
            unset($product);
        }
        mm_ok(['item' => $sale, 'products' => $products]);
    }
    if ($resource === 'purchases' && $method === 'POST') {
        $result = mm_create_purchase($pdo, mm_body());
        mm_ok(['item' => $result['purchase'], 'products' => $result['products']]);
    }

    $writers = [
        'products' => ['save' => 'mm_save_product', 'delete' => 'mm_delete_product', 'perm' => 'products'],
        'suppliers' => ['save' => 'mm_save_supplier', 'delete' => 'mm_delete_supplier', 'perm' => 'suppliers'],
        'customers' => ['save' => 'mm_save_customer', 'delete' => 'mm_delete_customer', 'perm' => 'customers'],
        'expenses' => ['save' => 'mm_save_expense', 'delete' => 'mm_delete_expense', 'perm' => 'expenses'],
        'users' => ['save' => 'mm_save_user', 'delete' => 'mm_delete_user', 'perm' => 'users'],
    ];
    if (isset($writers[$resource])) {
        $handler = $writers[$resource];
        if ($method === 'GET') {
            $user = mm_require_read($resource);
            $list = match ($resource) {
                'products' => mm_products($pdo),
                'suppliers' => mm_suppliers($pdo),
                'customers' => mm_customers($pdo),
                'expenses' => mm_expenses($pdo),
                'users' => mm_users($pdo),
                default => [],
            };
            if ($resource === 'products' && !mm_can_view_costs($user)) {
                $list = array_map(static function (array $product): array {
                    unset($product['buyingPrice']);
                    return $product;
                }, $list);
            }
            mm_ok(['items' => $list]);
        }
        if ($method === 'POST' || $method === 'PUT' || $method === 'PATCH') {
            $item = $handler['save']($pdo, mm_body(), $method === 'POST');
            mm_ok(['item' => $item], $method === 'POST' ? 201 : 200);
        }
        if ($method === 'DELETE') {
            $body = [];
            try {
                $body = mm_body();
            } catch (ApiException $e) {
                $body = [];
            }
            $handler['delete']($pdo, $id !== '' ? $id : (string) ($body['id'] ?? ''));
            mm_ok(['deleted' => true]);
        }
    }

    throw new ApiException('Unknown API route.', 404);
}
