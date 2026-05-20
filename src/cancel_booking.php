<?php

session_start();

require_once "../Database.php";

header("Content-Type: application/json");

try{

    if(!isset($_SESSION['user_id'])){

        echo json_encode([
            "success" => false,
            "message" => "Unauthorized."
        ]);

        exit;
    }

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

    // GET CLIENT ID OF LOGGED IN USER
    $clientSql = "
    SELECT client_id
    FROM clients
    WHERE user_id = ?
    ";

    $clientStmt = $conn->prepare($clientSql);

    $clientStmt->execute([
        $_SESSION['user_id']
    ]);

    $client =
        $clientStmt->fetch(PDO::FETCH_ASSOC);

    if(!$client){

        echo json_encode([
            "success" => false,
            "message" => "Client not found."
        ]);

        exit;
    }

    // MAKE SURE BOOKING BELONGS TO USER
    $checkSql = "
    SELECT booking_id
    FROM bookings
    WHERE booking_id = ?
    AND client_id = ?
    ";

    $checkStmt = $conn->prepare($checkSql);

    $checkStmt->execute([
        $booking_id,
        $client['client_id']
    ]);

    if($checkStmt->rowCount() === 0){

        echo json_encode([
            "success" => false,
            "message" => "Booking not found."
        ]);

        exit;
    }

    // CANCEL BOOKING
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