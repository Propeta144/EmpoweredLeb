<?php
/**
 * GET /src/get_service_slots.php?service_id=4
 * Returns all 24 time slots with a flag indicating whether each is
 * enabled for the given service.
 */
header('Content-Type: application/json');
require_once '../Database.php';

$serviceId = isset($_GET['service_id']) ? (int)$_GET['service_id'] : 0;
if ($serviceId <= 0) {
    echo json_encode(['success' => false, 'message' => 'service_id required.']);
    exit;
}

try {
    $db   = new Database();
    $conn = $db->connect();

    $stmt = $conn->prepare("
        SELECT
            sts.slot_id,
            sts.slot_label,
            CASE WHEN ssa.id IS NOT NULL THEN 1 ELSE 0 END AS is_enabled
        FROM   service_time_slots sts
        LEFT JOIN service_slot_availability ssa
               ON ssa.slot_id = sts.slot_id
               AND ssa.service_id = ?
        WHERE  sts.is_active = 1
        ORDER  BY sts.slot_id ASC
    ");
    $stmt->execute([$serviceId]);

    echo json_encode([
        'success' => true,
        'slots'   => $stmt->fetchAll(PDO::FETCH_ASSOC)
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}