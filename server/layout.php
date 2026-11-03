<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

const WIDGET_TYPES = [
    'compact',
    'wide',
    'free',
    'horizontal',
    'vertical',
    'square',
    'band',
    'block',
    'tower',
    'poster',
    'panorama',
    'banner',
    'image-gallery',
];

const GALLERY_DURATIONS = [5, 10, 20, 30, 45, 60];

function sanitize_gallery_settings(mixed $settings): ?array
{
    if (!is_array($settings)) {
        return null;
    }
    $urls = [];
    $rawUrls = $settings['urls'] ?? [];
    if (!is_array($rawUrls)) {
        return null;
    }
    foreach ($rawUrls as $url) {
        if (!is_string($url)) {
            return null;
        }
        $trimmed = trim($url);
        if ($trimmed === '') {
            continue;
        }
        if (strlen($trimmed) > 2048) {
            return null;
        }
        $urls[] = $trimmed;
    }
    $index = $settings['index'] ?? 0;
    if (!is_int($index) && !(is_numeric($index) && (int) $index == $index)) {
        return null;
    }
    $index = (int) $index;
    if ($index < 0) {
        return null;
    }
    if (count($urls) === 0) {
        $index = 0;
    } elseif ($index >= count($urls)) {
        $index = count($urls) - 1;
    }
    if (!array_key_exists('slideshow', $settings)) {
        $slideshow = false;
    } elseif (!is_bool($settings['slideshow'])) {
        return null;
    } else {
        $slideshow = $settings['slideshow'];
    }
    $duration = $settings['duration'] ?? 5;
    if (!is_int($duration) && !(is_numeric($duration) && (int) $duration == $duration)) {
        return null;
    }
    $duration = (int) $duration;
    if (!in_array($duration, GALLERY_DURATIONS, true)) {
        return null;
    }
    return [
        'urls' => $urls,
        'index' => $index,
        'slideshow' => $slideshow,
        'duration' => $duration,
    ];
}

function fail(int $status, string $error): void
{
    http_response_code($status);
    echo json_encode(['error' => $error], JSON_UNESCAPED_UNICODE);
    exit;
}

function client_id(): string
{
    $id = (string) ($_SERVER['HTTP_X_CLIENT_ID'] ?? '');
    if (preg_match('/^[0-9a-f-]{36}$/i', $id) !== 1) {
        fail(400, 'invalid client');
    }
    return strtolower($id);
}

function sanitize_document(mixed $document): ?array
{
    if (!is_array($document) || ($document['version'] ?? null) !== 1 || !is_array($document['widgets'] ?? null)) {
        return null;
    }
    if (!is_numeric($document['updatedAt'] ?? null)) {
        return null;
    }
    $widgets = [];
    foreach ($document['widgets'] as $widget) {
        if (!is_array($widget)) {
            return null;
        }
        $id = $widget['id'] ?? '';
        $type = $widget['type'] ?? '';
        $w = $widget['w'] ?? 0;
        $h = $widget['h'] ?? 0;
        if (!is_string($id) || strlen($id) < 1 || strlen($id) > 64 || preg_match('/^[A-Za-z0-9-]+$/', $id) !== 1) {
            return null;
        }
        if (!is_string($type) || !in_array($type, WIDGET_TYPES, true)) {
            return null;
        }
        if (!is_numeric($w) || !is_numeric($h)) {
            return null;
        }
        $w = (int) $w;
        $h = (int) $h;
        $x = array_key_exists('x', $widget) && is_numeric($widget['x']) ? (int) $widget['x'] : -1;
        $y = array_key_exists('y', $widget) && is_numeric($widget['y']) ? (int) $widget['y'] : -1;
        if ($w < 1 || $h < 1 || $w > 80 || $h > 80 || $x < -1 || $y < -1 || $x > 400 || $y > 400) {
            return null;
        }
        $stored = ['id' => $id, 'type' => $type, 'w' => $w, 'h' => $h, 'x' => $x, 'y' => $y];
        if ($type === 'image-gallery') {
            $settings = sanitize_gallery_settings($widget['settings'] ?? [
                'urls' => [],
                'index' => 0,
                'slideshow' => false,
                'duration' => 5,
            ]);
            if ($settings === null) {
                return null;
            }
            $stored['settings'] = $settings;
        }
        $widgets[] = $stored;
    }
    return [
        'version' => 1,
        'updatedAt' => (int) $document['updatedAt'],
        'widgets' => $widgets,
    ];
}

try {
    $id = client_id();
    $pdo = db();
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->prepare('SELECT document FROM layouts WHERE client_id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            fail(404, 'not found');
        }
        $document = json_decode((string) $row['document'], true);
        if (!is_array($document)) {
            fail(500, 'invalid stored document');
        }
        echo json_encode(['document' => $document], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        $raw = file_get_contents('php://input');
        if ($raw === false || strlen($raw) > 1_000_000) {
            fail(400, 'invalid body');
        }
        $body = json_decode($raw, true);
        $document = sanitize_document(is_array($body) ? ($body['document'] ?? null) : null);
        if ($document === null) {
            fail(400, 'invalid document');
        }
        $json = json_encode($document, JSON_UNESCAPED_UNICODE);
        if ($json === false) {
            fail(500, 'encode failed');
        }
        $updatedAt = $document['updatedAt'];
        if (config_value('DB_DRIVER', 'sqlite') === 'mysql') {
            $stmt = $pdo->prepare(
                'INSERT INTO layouts (client_id, document, updated_at) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE document = VALUES(document), updated_at = VALUES(updated_at)'
            );
        } else {
            $stmt = $pdo->prepare(
                'INSERT INTO layouts (client_id, document, updated_at) VALUES (?, ?, ?)
                 ON CONFLICT(client_id) DO UPDATE SET document = excluded.document, updated_at = excluded.updated_at'
            );
        }
        $stmt->execute([$id, $json, $updatedAt]);
        echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
        exit;
    }

    fail(405, 'method not allowed');
} catch (Throwable $error) {
    fail(500, 'server');
}
