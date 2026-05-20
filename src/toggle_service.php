<?php
/**
 * POST /api/services/toggle_service.php
 * Flips availability_status between 'available' and 'unavailable'.
 * Does NOT cancel existing bookings.
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

    $sel = $conn->prepare("SELECT availability_status FROM services WHERE service_id = ?");
    $sel->execute([$serviceId]);
    $row = $sel->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Service not found.']);
        exit;
    }

    $newStatus = $row['availability_status'] === 'available' ? 'unavailable' : 'available';

    $upd = $conn->prepare("UPDATE services SET availability_status = ? WHERE service_id = ?");
    $upd->execute([$newStatus, $serviceId]);

    echo json_encode([
        'success'             => true,
        'availability_status' => $newStatus,
        'message'             => $newStatus === 'available' ? 'Service enabled.' : 'Service disabled.'
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
