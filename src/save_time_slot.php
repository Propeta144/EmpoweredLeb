<?php

header('Content-Type: application/json');

require_once '../Database.php';

$data = json_decode(file_get_contents("php://input"), true);

try {

    $db = new Database();
    $conn = $db->connect();

    $slotId = $data['slot_id'] ?? null;
    $label  = trim($data['slot_label'] ?? '');

    if (!$label) {
        throw new Exception('Time slot is required.');
    }

    if ($slotId) {

        $stmt = $conn->prepare("
            UPDATE service_time_slots
            SET slot_label = ?
            WHERE slot_id = ?
        ");

        $stmt->execute([$label, $slotId]);

        echo json_encode([
            'success' => true,
            'message' => 'Time slot updated.'
        ]);

    } else {

        $stmt = $conn->prepare("
            INSERT INTO service_time_slots(slot_label)
            VALUES(?)
        ");

        $stmt->execute([$label]);

        echo json_encode([
            'success' => true,
            'slot_id' => $conn->lastInsertId(),
            'message' => 'Time slot added.'
        ]);
    }

} catch(Exception $e){

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}