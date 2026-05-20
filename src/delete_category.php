<?php
/**
 * POST /api/services/delete_category.php
 * Deletes a service category only when no pending/approved bookings exist
 * for any service in that category.
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

    // Guard: check for active bookings tied to this category's services
    $check = $conn->prepare("
        SELECT COUNT(*) AS cnt
        FROM bookings b
        INNER JOIN services s ON b.service_id = s.service_id
        WHERE s.category_id = ?
          AND b.status NOT IN ('completed','cancelled')
    ");
    $check->execute([$categoryId]);
    $count = (int) $check->fetchColumn();

    if ($count > 0) {
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'message' => "Cannot delete: {$count} active booking(s) exist for services in this category."
        ]);
        exit;
    }

    // Safe to delete – FK CASCADE removes service_categories → services → modes/schedules
    $del = $conn->prepare("DELETE FROM service_categories WHERE category_id = ?");
    $del->execute([$categoryId]);

    echo json_encode(['success' => true, 'message' => 'Category deleted.']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
