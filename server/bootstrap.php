<?php
declare(strict_types=1);

if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === __FILE__) {
    http_response_code(404);
    exit;
}

function parse_env_file(string $path): array
{
    if (!is_file($path)) {
        return [];
    }
    $vars = [];
    $lines = file($path, FILE_IGNORE_NEW_LINES);
    if ($lines === false) {
        return [];
    }
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        $eq = strpos($line, '=');
        if ($eq === false) {
            continue;
        }
        $key = trim(substr($line, 0, $eq));
        $value = trim(substr($line, $eq + 1));
        if (
            (str_starts_with($value, '"') && str_ends_with($value, '"'))
            || (str_starts_with($value, "'") && str_ends_with($value, "'"))
        ) {
            $value = substr($value, 1, -1);
        }
        $vars[$key] = $value;
    }
    return $vars;
}

function app_config(): array
{
    static $config = null;
    if (is_array($config)) {
        return $config;
    }
    $file = __DIR__ . '/config.php';
    if (is_file($file)) {
        $loaded = require $file;
        if (is_array($loaded)) {
            $config = $loaded;
            return $config;
        }
    }
    $config = parse_env_file(dirname(__DIR__) . '/.env');
    return $config;
}

function config_value(string $key, string $fallback = ''): string
{
    $config = app_config();
    $value = $config[$key] ?? $fallback;
    return is_string($value) ? $value : $fallback;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $driver = config_value('DB_DRIVER', 'sqlite');
    if ($driver === 'mysql') {
        $host = config_value('DB_HOST', 'localhost');
        $port = config_value('DB_PORT', '3306');
        $name = config_value('DB_NAME');
        $user = config_value('DB_USER');
        $password = config_value('DB_PASSWORD');
        $pdo = new PDO(
            "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4",
            $user,
            $password,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS layouts (
                client_id VARCHAR(64) PRIMARY KEY,
                document LONGTEXT NOT NULL,
                updated_at BIGINT NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
        return $pdo;
    }

    $path = config_value('DB_SQLITE_PATH', 'storage/dashboard.sqlite');
    if ($path === '' || $path[0] !== '/') {
        $path = dirname(__DIR__) . '/' . ltrim($path, '/');
    }
    $directory = dirname($path);
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        throw new RuntimeException('Cannot create the SQLite directory');
    }
    $pdo = new PDO('sqlite:' . $path, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS layouts (
            client_id TEXT PRIMARY KEY,
            document TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        )'
    );
    return $pdo;
}
