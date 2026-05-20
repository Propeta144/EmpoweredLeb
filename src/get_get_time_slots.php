<?php

header('Content-Type: application/json');

require_once '../Database.php';

try {

    $db = new Database();
    $conn = $db->connect();

    $stmt = $conn->query("
        SELECT slot_id, slot_label
        FROM service_time_slots
        ORDER BY slot_id ASC
    ");

    echo json_encode([
        'success' => true,
        'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)
    ]);

} catch(Exception $e){

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}