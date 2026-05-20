<?php
/**
 * POST /api/services/delete_service.php
 * Deletes a service only when no pending/approved bookings exist for it.
 * FK CASCADE removes service_modes, service_schedules, service_items automatically.
 *
 * Body: { "service_id": int }
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once '../Database.php';

$input     = json_decode(file_get_contents('php://input'), true);
$serviceId = isset($input['service_id']) ? (int) $input['service_id'] : 0;

if ($serviceId <= 0) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Invalid service_id.']);
    exit;
}

try {
    $db   = new Database();
    $conn = $db->connect();

    // Guard against active bookings
    $check = $conn->prepare("
        SELECT COUNT(*) FROM bookings
        WHERE service_id = ?
          AND status NOT IN ('completed','cancelled')
    ");
    $check->execute([$serviceId]);
    $count = (int) $check->fetchColumn();

    if ($count > 0) {
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'message' => "Cannot delete: {$count} active booking(s) exist for this service."
        ]);
        exit;
    }

    $del = $conn->prepare("DELETE FROM services WHERE service_id = ?");
    $del->execute([$serviceId]);

    echo json_encode(['success' => true, 'message' => 'Service deleted.']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
