<?php

header('Content-Type: application/json');

require_once '../Database.php';

$data = json_decode(file_get_contents("php://input"), true);

try {

    $db = new Database();
    $conn = $db->connect();

    $slotId = intval($data['slot_id'] ?? 0);

    if (!$slotId) {
        throw new Exception('Invalid slot.');
    }

    $stmt = $conn->prepare("
        DELETE FROM service_time_slots
        WHERE slot_id = ?
    ");

    $stmt->execute([$slotId]);

    echo json_encode([
        'success' => true
    ]);

} catch(Exception $e){

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}