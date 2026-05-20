<?php
/**
 * GET /src/admin_get_categories.php
 * Returns all service categories with their services, modes,
 * service items (title + description), schedules, and category features.
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once '../Database.php';

try {
    $db   = new Database();
    $conn = $db->connect();

    // ── 1. Categories ────────────────────────────────────────────────────────
    $catStmt = $conn->query("
        SELECT
            category_id,
            category_name,
            description,
            short_description,
            detail_title,
            detail_description,
            icon_class,
            is_active
        FROM service_categories
        ORDER BY category_id ASC
    ");
    $categories = $catStmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($categories)) {
        echo json_encode(['success' => true, 'data' => []]);
        exit;
    }

    $categoryIds = array_column($categories, 'category_id');
    $inCat       = implode(',', array_fill(0, count($categoryIds), '?'));

    // ── 2. Category features ─────────────────────────────────────────────────
    $featStmt = $conn->prepare("
        SELECT feature_id, category_id, feature_text
        FROM   category_features
        WHERE  category_id IN ($inCat)
        ORDER  BY feature_id ASC
    ");
    $featStmt->execute($categoryIds);
    $featMap = [];
    foreach ($featStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $featMap[$row['category_id']][] = [
            'feature_id'   => (int) $row['feature_id'],
            'feature_text' => $row['feature_text'],
        ];
    }

    // ── 3. Services ──────────────────────────────────────────────────────────
    $svcStmt = $conn->prepare("
        SELECT
            service_id,
            category_id,
            service_name,
            description,
            price_range,
            duration_text,
            icon_class,
            availability_status
        FROM services
        WHERE category_id IN ($inCat)
        ORDER BY service_id ASC
    ");
    $svcStmt->execute($categoryIds);
    $services   = $svcStmt->fetchAll(PDO::FETCH_ASSOC);
    $serviceIds = array_column($services, 'service_id');

    $modeMap     = [];
    $itemMap     = [];
    $scheduleMap = [];

    if (!empty($serviceIds)) {
        $inSvc = implode(',', array_fill(0, count($serviceIds), '?'));

        // ── 4. Service modes ─────────────────────────────────────────────────
        $modeStmt = $conn->prepare("
            SELECT mode_id, service_id, mode_name, icon_class
            FROM   service_modes
            WHERE  service_id IN ($inSvc)
        ");
        $modeStmt->execute($serviceIds);
        foreach ($modeStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $modeMap[$row['service_id']][] = [
                'mode_id'    => (int) $row['mode_id'],
                'mode_name'  => $row['mode_name'],
                'icon_class' => $row['icon_class'],
            ];
        }

        // ── 5. Service items (title + description) ───────────────────────────
        $itemStmt = $conn->prepare("
            SELECT item_id, service_id, title, description
            FROM   service_items
            WHERE  service_id IN ($inSvc)
            ORDER  BY item_id ASC
        ");
        $itemStmt->execute($serviceIds);
        foreach ($itemStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $itemMap[$row['service_id']][] = [
                'item_id'     => (int) $row['item_id'],
                'title'       => $row['title'],
                'description' => $row['description'],
            ];
        }

        // ── 6. Service schedules ─────────────────────────────────────────────
        $schedStmt = $conn->prepare("
            SELECT schedule_id, service_id, day_label, time_label
            FROM   service_schedules
            WHERE  service_id IN ($inSvc)
        ");
        $schedStmt->execute($serviceIds);
        foreach ($schedStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $days = $row['day_label'] ? explode(',', $row['day_label']) : [];
            $scheduleMap[$row['service_id']] = [
                'schedule_id' => (int) $row['schedule_id'],
                'days'        => array_map('trim', $days),
                'time_label'  => $row['time_label'],
            ];
        }
    }

    // ── 7. Assemble ──────────────────────────────────────────────────────────
    $servicesByCategory = [];
    foreach ($services as $svc) {
        $sid             = $svc['service_id'];
        $svc['modes']    = $modeMap[$sid]     ?? [];
        $svc['items']    = $itemMap[$sid]     ?? [];
        $svc['schedule'] = $scheduleMap[$sid] ?? null;
        $servicesByCategory[$svc['category_id']][] = $svc;
    }

    foreach ($categories as &$cat) {
        $cat['features'] = $featMap[$cat['category_id']] ?? [];
        $cat['services'] = $servicesByCategory[$cat['category_id']] ?? [];
    }
    unset($cat);

    echo json_encode(['success' => true, 'data' => $categories]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}