<?php
/**
 * POST /src/save_service_slots.php
 * Body: { "service_id": 4, "slot_ids": [10,11,12,13,14,15,16,17] }
 * Replaces the service's slot availability with the supplied list.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once '../Database.php';

$input     = json_decode(file_get_contents('php://input'), true);
$serviceId = isset($input['service_id']) ? (int)$input['service_id'] : 0;
$slotIds   = is_array($input['slot_ids'] ?? null) ? array_map('intval', $input['slot_ids']) : [];

if ($serviceId <= 0) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'service_id required.']);
    exit;
}

try {
    $db   = new Database();
    $conn = $db->connect();
    $conn->beginTransaction();

    // Delete all existing entries for this service
    $conn->prepare("DELETE FROM service_slot_availability WHERE service_id = ?")
         ->execute([$serviceId]);

    // Re-insert selected slots
    if (!empty($slotIds)) {
        $stmt = $conn->prepare(
            "INSERT IGNORE INTO service_slot_availability (service_id, slot_id) VALUES (?, ?)"
        );
        foreach ($slotIds as $slotId) {
            $stmt->execute([$serviceId, $slotId]);
        }
    }

    $conn->commit();
    echo json_encode(['success' => true, 'message' => 'Schedule saved.']);
} catch (Exception $e) {
    isset($conn) && $conn->inTransaction() && $conn->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}