<?php

session_start();

header("Content-Type: application/json");

require_once "../Database.php";

try{

    $booking_id =
        $_POST['booking_id'] ?? null;

    if(!$booking_id){

        echo json_encode([
            "success" => false,
            "message" => "Missing booking ID."
        ]);

        exit;
    }

    $db = new Database();
    $conn = $db->connect();

    $sql = "
    UPDATE bookings
    SET status = 'cancelled'
    WHERE booking_id = ?
    ";

    $stmt = $conn->prepare($sql);

    $stmt->execute([
        $booking_id
    ]);

    echo json_encode([
        "success" => true
    ]);

}catch(PDOException $e){

    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]);
}
?>