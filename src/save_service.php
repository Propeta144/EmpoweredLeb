<?php
/**
 * POST /src/save_service.php
 * Creates or updates a service row plus its linked modes,
 * service_items (title + description), and schedule.
 *
 * Expected JSON body:
 * {
 *   "service_id":   null | int,
 *   "category_id":  int,
 *   "service_name": string,
 *   "description":  string | null,
 *   "icon_class":   string | null,
 *   "price_range":  string | null,
 *   "duration_text":string | null,
 *   "modes":        string[],          e.g. ["Walk In","Home Service"]
 *   "items": [
 *     { "title": string, "description": string | null },
 *     ...
 *   ],
 *   "schedule": {
 *     "days":       string[],          e.g. ["Mon","Tue","Wed"]
 *     "time_label": string             e.g. "9:00 AM – 6:00 PM"
 *   }
 * }
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once '../Database.php';

$input = json_decode(file_get_contents('php://input'), true);

// ── Validation ────────────────────────────────────────────────────────────────
$serviceName  = trim($input['service_name']  ?? '');
$categoryId   = isset($input['category_id']) ? (int) $input['category_id'] : 0;
$serviceId    = isset($input['service_id']) && $input['service_id'] !== null
                    ? (int) $input['service_id'] : null;

if ($serviceName === '') {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'service_name is required.']);
    exit;
}
if ($categoryId <= 0) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'A valid category_id is required.']);
    exit;
}

$description  = trim($input['description']  ?? '');
$iconClass    = trim($input['icon_class']    ?? '');
$priceRange   = trim($input['price_range']   ?? '');
$durationText = trim($input['duration_text'] ?? '');

// Modes
$allowedModes = ['Walk In', 'Home Service', 'Online'];
$modeIconMap  = [
    'Walk In'      => 'fa-solid fa-shop',
    'Home Service' => 'fa-solid fa-house',
    'Online'       => 'fa-solid fa-video',
];
$modes = is_array($input['modes'] ?? null)
    ? array_values(array_intersect($input['modes'], $allowedModes))
    : [];

// Items – each is { title, description }
$rawItems = is_array($input['items'] ?? null) ? $input['items'] : [];
$items = [];
foreach ($rawItems as $it) {
    $title = trim($it['title'] ?? '');
    if ($title === '') continue;
    $items[] = [
        'title'       => $title,
        'description' => trim($it['description'] ?? '') ?: null,
    ];
}

// Schedule
$allowedDays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
$schedDays   = is_array($input['schedule']['days'] ?? null)
    ? array_values(array_intersect($input['schedule']['days'], $allowedDays))
    : [];
$schedTime   = trim($input['schedule']['time_label'] ?? '');

try {
    $db   = new Database();
    $conn = $db->connect();
    $conn->beginTransaction();

    // ── 1. Upsert service ─────────────────────────────────────────────────────
    if ($serviceId === null) {
        $stmt = $conn->prepare("
            INSERT INTO services
                (category_id, service_name, description, icon_class,
                 price_range, duration_text, availability_status)
            VALUES
                (:category_id, :service_name, :description, :icon_class,
                 :price_range, :duration_text, 'available')
        ");
        $stmt->execute([
            ':category_id'   => $categoryId,
            ':service_name'  => $serviceName,
            ':description'   => $description  ?: null,
            ':icon_class'    => $iconClass     ?: null,
            ':price_range'   => $priceRange    ?: null,
            ':duration_text' => $durationText  ?: null,
        ]);
        $serviceId = (int) $conn->lastInsertId();
        $message   = 'Service created.';
    } else {
        $conn->prepare("
            UPDATE services SET
                category_id   = :category_id,
                service_name  = :service_name,
                description   = :description,
                icon_class    = :icon_class,
                price_range   = :price_range,
                duration_text = :duration_text
            WHERE service_id = :service_id
        ")->execute([
            ':category_id'   => $categoryId,
            ':service_name'  => $serviceName,
            ':description'   => $description  ?: null,
            ':icon_class'    => $iconClass     ?: null,
            ':price_range'   => $priceRange    ?: null,
            ':duration_text' => $durationText  ?: null,
            ':service_id'    => $serviceId,
        ]);
        $message = 'Service updated.';
    }

    // ── 2. Replace modes ──────────────────────────────────────────────────────
    $conn->prepare("DELETE FROM service_modes WHERE service_id = ?")->execute([$serviceId]);
    if (!empty($modes)) {
        $modeStmt = $conn->prepare("
            INSERT INTO service_modes (service_id, mode_name, icon_class)
            VALUES (:service_id, :mode_name, :icon_class)
        ");
        foreach ($modes as $modeName) {
            $modeStmt->execute([
                ':service_id' => $serviceId,
                ':mode_name'  => $modeName,
                ':icon_class' => $modeIconMap[$modeName] ?? '',
            ]);
        }
    }

    // ── 3. Replace service items (title + description) ────────────────────────
    $conn->prepare("DELETE FROM service_items WHERE service_id = ?")->execute([$serviceId]);
    if (!empty($items)) {
        $itemStmt = $conn->prepare("
            INSERT INTO service_items (service_id, title, description)
            VALUES (:service_id, :title, :description)
        ");
        foreach ($items as $item) {
            $itemStmt->execute([
                ':service_id'  => $serviceId,
                ':title'       => $item['title'],
                ':description' => $item['description'],
            ]);
        }
    }

    // ── 4. Upsert schedule ────────────────────────────────────────────────────
    if (!empty($schedDays) || $schedTime !== '') {
        $dayLabel = implode(',', $schedDays);

        $existing = $conn->prepare(
            "SELECT schedule_id FROM service_schedules WHERE service_id = ? LIMIT 1"
        );
        $existing->execute([$serviceId]);
        $existRow = $existing->fetch(PDO::FETCH_ASSOC);

        if ($existRow) {
            $conn->prepare("
                UPDATE service_schedules
                SET day_label = :day_label, time_label = :time_label
                WHERE schedule_id = :schedule_id
            ")->execute([
                ':day_label'   => $dayLabel,
                ':time_label'  => $schedTime ?: null,
                ':schedule_id' => $existRow['schedule_id'],
            ]);
        } else {
            $conn->prepare("
                INSERT INTO service_schedules (service_id, day_label, time_label)
                VALUES (:service_id, :day_label, :time_label)
            ")->execute([
                ':service_id' => $serviceId,
                ':day_label'  => $dayLabel,
                ':time_label' => $schedTime ?: null,
            ]);
        }
    }

    $conn->commit();

    echo json_encode([
        'success'    => true,
        'message'    => $message,
        'service_id' => $serviceId,
    ]);

} catch (Exception $e) {
    isset($conn) && $conn->inTransaction() && $conn->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}