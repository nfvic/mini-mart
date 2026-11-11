# MiniMart Computerized Accounting System

MiniMart is a vanilla HTML/CSS/JavaScript application backed by a PHP 8.2 REST API and Supabase PostgreSQL. Business records are read and written through the PHP API; the browser does not persist business records or passwords. It stores a theme preference, an optional remembered username, and a per-tab CSRF token.

The accounting views calculate sales revenue, cost of goods sold (COGS), gross profit, operating expenses, net profit, and inventory valuation. This is not a double-entry accounting ledger.

## Requirements

- PHP 8.2 or newer
- PHP extensions `pdo_pgsql` and `openssl`
- A Supabase project with PostgreSQL connection details
- A modern browser

## Supabase setup

1. In the Supabase SQL Editor, run `database/schema.sql`. It is safe to rerun to apply schema and role-permission updates.
2. On a fresh demonstration database only, run `database/seed_data.sql` to add sample business records. This script replaces business sample records; do not rerun it on a database containing records you need to keep.
3. The four demonstration users are created by `schema.sql`.
4. Use your project's PostgreSQL connection values. The PHP backend connects directly over TLS; it does not use a Supabase service-role key or the browser-facing Data API.

The schema enables Row Level Security and revokes the `anon` and `authenticated` Data API roles. The PHP backend uses its PostgreSQL connection and must enforce application permissions itself.

## Environment configuration

Copy the example file and set the values locally:

```powershell
Copy-Item .env.example .env
```

Set these variables in `.env`:

| Variable | Description |
|---|---|
| `SUPABASE_DB_HOST` | Supabase PostgreSQL host |
| `SUPABASE_DB_PORT` | PostgreSQL port, normally `5432` |
| `SUPABASE_DB_NAME` | Database name, normally `postgres` |
| `SUPABASE_DB_USER` | Database user from Supabase connection details |
| `SUPABASE_DB_PASSWORD` | Database password; never place it in frontend files |
| `APP_ENV` | Use `development` locally and `production` when deployed |
| `APP_SECRET` | Reserved for future application-specific signing; keep it private and generate a long random value |

`.env` and `config/config.php` are ignored by Git. Do not commit credentials. The example configuration contains placeholders only.

## Run locally

Open PowerShell in the project directory and start PHP's built-in development server:

```powershell
php -S 127.0.0.1:8000 -t .
```

Open `http://127.0.0.1:8000/` in your browser. Check the API/database connection at `http://127.0.0.1:8000/api/index.php?r=health`. Do not use `file://` or a static-only Live Server for normal operation; neither runs PHP.

For deployments, use a supported PHP web server, HTTPS, a valid Supabase database connection, a non-development `APP_ENV`, and appropriate PHP request-size limits (at least 8 MB if importing data). Keep the `.env` file outside public web access where the host permits.

## Demonstration users

The schema seeds these accounts for local demonstration:

| Role | Username | Initial password |
|---|---|---|
| Administrator | `admin` | `admin123` |
| Cashier | `cashier` | `cashier123` |
| Accountant | `accountant` | `account123` |
| Storekeeper | `storekeeper` | `store123` |

Change all demonstration passwords before deployment. User passwords are stored as hashes; never reuse these initial credentials in a real environment.

## Modules and permissions

The application includes dashboard, POS/sales, products, inventory, purchases, suppliers, customers, expenses, accounting, reports, user management, and business settings. The PHP API checks session authentication and role permissions; client-side navigation restrictions are not the security boundary. Cashiers do not receive purchase/expense records or product/sale cost prices. The system uses PHP sessions, HTTP-only cookies, session regeneration on login, CSRF tokens, prepared statements, and login-attempt throttling.

## Theme

The shared sun/moon toggle is available on the public landing page, login page, and application pages. The first visit follows the operating-system theme; a chosen light/dark setting is saved in browser LocalStorage.

## Import existing browser data

1. Open the upgraded application in the same browser profile and origin (scheme, hostname, and port) that contains the older MiniMart LocalStorage data.
2. Sign in as Administrator and open **Settings → Demonstration data**.
3. Choose **Export legacy browser data** and save the JSON file somewhere safe.
4. Select that JSON file and choose **Import selected data**.

The importer adds legacy products, suppliers, customers, sales, purchases, expenses, and settings. Existing records are retained; duplicate records are skipped. Historical sales and purchases are marked as already applied, so their stock movements are not repeated. User accounts and passwords are not imported. Back up the JSON file before importing; the import is transactional and will roll back if a record is invalid. The importer accepts files up to 5 MB.

## Reset demonstration data

**Settings → Reset demonstration data** replaces business sample records with the included seed dataset. Export any legacy records first. User accounts are not deleted. Do not use the reset option on a live business database.

## Development and security notes

- The PHP API is under `api/`; configuration examples are under `config/`; SQL scripts are under `database/`.
- Database credentials are server-side only. Do not put database passwords or Supabase service-role keys in HTML or JavaScript.
- Validate deployment configuration, enable HTTPS, change seeded user passwords, and use an appropriately restricted database role.
- Sales and purchases update inventory in database transactions. A sale checks stock under row locks and request IDs make transaction retries idempotent.
- Purchases are inventory acquisitions, not operating expenses. Profit is reported as revenue minus COGS minus operating expenses.
- The project has not been independently audited or tested against a live Supabase project; configure a non-production database and verify the setup before deployment.
