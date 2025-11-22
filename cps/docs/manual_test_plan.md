# CPS Manual Test Plan — PHP PDO

This document describes manual steps to test the CPS provisioning flow and PHP PDO connectivity using the one-time connection string and the provided `mydb.php` wrapper.

Prerequisites
- Docker (for local MySQL) or an accessible MySQL instance
- CPS server running and configured with `CPS_ADMIN_API_KEY` and `CPS_DEFAULT_DB_ID`
- `mydb.php` available under `/cps/snippets/mydb.php` or download from the CPS admin UI

Steps

1. Provision a new per-user connection via CPS admin API (or via the main site Settings → Fetch if proxy is set up):

```bash
curl -X POST -H "Content-Type: application/json" -d '{"usernamePrefix":"testuser_","ttl":3600}' "https://cps.example.com/api/databases/<DB_ID>/provision-user" -H "x-api-key: ${CPS_ADMIN_API_KEY}"
```

Response should include `connectionString`, `snippets.php.env`, `snippets.php.snippet`, and `one_time_token`.

2. Save the `connectionString` and download `mydb.php` to a working directory.

3. Create `test_db.php` using the `.env` block from the snippets (example below):

```php
<?php
require_once 'mydb.php';
$dsn = 'mysql:host=DB_HOST;port=3306;dbname=DB_NAME;charset=utf8mb4';
$user = 'DB_USER';
$pass = 'DB_PASS';
$db = new MyDB($dsn, $user, $pass);
try {
  $row = $db->fetch('SELECT NOW()');
  print_r($row);
} catch (Exception $e) {
  echo "Connection failed: " . $e->getMessage();
}
?>
```

Replace `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS` with values from the CPS-provided `.env` or parse the `connectionString`.

4. Run the PHP script locally (requires PHP + PDO installed):

```bash
php test_db.php
```

Expected: Should print a row with the current time or database server response. If it fails, check network connectivity, user privileges, and that the TTL has not expired.

5. Rotation/Revoke
- Use the CPS admin API to rotate the password or revoke the user and verify that connections fail after revoke.

```bash
curl -X POST -H "Content-Type: application/json" -d '{"username":"testuser_xyz"}' "https://cps.example.com/api/databases/<DB_ID>/revoke-user" -H "x-api-key: ${CPS_ADMIN_API_KEY}"
```

6. Notes
- The plaintext password is only returned once. If you miss it, rotate the user to get a new password.
- All passwords are encrypted at rest; the server stores encrypted_password and a `revealed` flag to avoid returning plaintext again.
