<?php
/**
 * POST /api/services/toggle_category.php
 * Flips is_active for a service_category row.
 * Disabling a category does NOT delete data and does NOT cancel existing bookings.
 *
 * Body: { "category_id": int }
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once '../Database.php';

$input      = json_decode(file_get_contents('php://input'), true);
$categoryId = isset($input['category_id']) ? (int) $input['category_id'] : 0;

if ($categoryId <= 0) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Invalid category_id.']);
    exit;
}

try {
    $db   = new Database();
    $conn = $db->connect();

    // Read current state
    $sel = $conn->prepare("SELECT is_active FROM service_categories WHERE category_id = ?");
    $sel->execute([$categoryId]);
    $row = $sel->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Category not found.']);
        exit;
    }

    $newState = $row['is_active'] ? 0 : 1;

    $upd = $conn->prepare("UPDATE service_categories SET is_active = ? WHERE category_id = ?");
    $upd->execute([$newState, $categoryId]);

    echo json_encode([
        'success'   => true,
        'is_active' => $newState,
        'message'   => $newState ? 'Category activated.' : 'Category deactivated.'
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
