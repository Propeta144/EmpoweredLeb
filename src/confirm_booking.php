<?php

session_start();

header("Content-Type: application/json");

require_once "../Database.php";

try{

    if($_SERVER["REQUEST_METHOD"] !== "POST"){
        throw new Exception("Invalid request method.");
    }

    $bookingId = intval($_POST["booking_id"] ?? 0);

    if($bookingId <= 0){
        throw new Exception("Invalid booking ID.");
    }

    $db   = new Database();
    $conn = $db->connect();

    // Verify booking exists and is in 'waiting' state
    $stmt = $conn->prepare("SELECT booking_id, status FROM bookings WHERE booking_id = ?");
    $stmt->execute([$bookingId]);
    $booking = $stmt->fetch(PDO::FETCH_ASSOC);

    if(!$booking){
        throw new Exception("Booking not found.");
    }

    if($booking["status"] !== "waiting"){
        throw new Exception("This booking cannot be confirmed at its current status.");
    }

    $conn->beginTransaction();

    // Update booking status to confirmed
    $conn->prepare("
        UPDATE bookings SET status = 'confirmed', updated_at = NOW()
        WHERE booking_id = ?
    ")->execute([$bookingId]);

    // Mark quotation as accepted
    $conn->prepare("
        UPDATE booking_quotations
        SET quotation_status = 'accepted', updated_at = NOW()
        WHERE booking_id = ?
    ")->execute([$bookingId]);

    $conn->commit();

    echo json_encode([
        "success" => true,
        "message" => "Booking confirmed successfully.",
    ]);

}catch(Exception $e){

    if(isset($conn) && $conn->inTransaction()){
        $conn->rollBack();
    }

    echo json_encode([
        "success" => false,
        "message" => $e->getMessage(),
    ]);
}
?>