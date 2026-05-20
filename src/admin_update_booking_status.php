<?php

session_start();

header("Content-Type: application/json");

require_once "../Database.php";

try{

    if($_SERVER["REQUEST_METHOD"] !== "POST"){
        throw new Exception("Invalid request method.");
    }

    $bookingId       = intval(trim($_POST["booking_id"]       ?? 0));
    $action          = trim($_POST["action"]                  ?? "");
    $quotationAmount = trim($_POST["quotation_amount"]        ?? "");
    $adminNotes      = trim($_POST["admin_notes"]             ?? "");

    if($bookingId <= 0)  throw new Exception("Invalid booking ID.");
    if(empty($action))   throw new Exception("Action is required.");

    // =========================================
    // CONNECT DB
    // =========================================

    $db   = new Database();
    $conn = $db->connect();

    // =========================================
    // RESOLVE ADMIN USER
    // No login session yet — grab the first
    // user with role_id = 1 (admin) from the DB.
    // Replace this block once login is set up:
    //   $changedBy = intval($_SESSION["user_id"]);
    // =========================================

    $adminRow = $conn->query("
        SELECT user_id FROM users WHERE role_id = 1 LIMIT 1
    ")->fetch(PDO::FETCH_ASSOC);

    if(!$adminRow){
        throw new Exception("No admin user found in the database.");
    }

    $changedBy = intval($adminRow["user_id"]);

    // =========================================
    // GET CURRENT BOOKING
    // =========================================

    $bookingStmt = $conn->prepare("
        SELECT booking_id, status FROM bookings WHERE booking_id = ?
    ");
    $bookingStmt->execute([$bookingId]);
    $booking = $bookingStmt->fetch(PDO::FETCH_ASSOC);

    if(!$booking) throw new Exception("Booking not found.");

    $oldStatus = $booking["status"];

    // =========================================
    // DETERMINE NEW STATUS
    // =========================================

    // ── DETERMINE NEW STATUS ──────────────────────────────────
switch ($action) {
    case "approve":   $newStatus = "waiting";          break;
    case "reject":    $newStatus = "cancelled";        break;
    // "complete" now moves to awaiting_payment, not completed
    case "complete":  $newStatus = "awaiting_payment"; break;
    // new action: admin confirms payment received
    case "paid":      $newStatus = "completed";        break;
    case "cancel":    $newStatus = "cancelled";        break;
    default: throw new Exception("Invalid action.");
}

// ── VALIDATION ────────────────────────────────────────────
if ($action === "approve") {
    if (empty($quotationAmount))
        throw new Exception("Quotation amount is required.");
    if (!is_numeric($quotationAmount))
        throw new Exception("Quotation amount must be numeric.");
    if (floatval($quotationAmount) <= 0)
        throw new Exception("Quotation amount must be greater than 0.");
    if (empty($adminNotes))
        throw new Exception("Admin notes are required when approving.");
}
if ($action === "reject" && empty($adminNotes)) {
    throw new Exception("A rejection reason (admin notes) is required.");
}

// ── TRANSACTION ───────────────────────────────────────────
$conn->beginTransaction();

$conn->prepare("
    UPDATE bookings SET status = ?, updated_at = NOW() WHERE booking_id = ?
")->execute([$newStatus, $bookingId]);

if ($action === "approve") {
    $existingStmt = $conn->prepare(
        "SELECT quotation_id FROM booking_quotations WHERE booking_id = ?"
    );
    $existingStmt->execute([$bookingId]);
    if ($existingStmt->fetch()) {
        $conn->prepare("
            UPDATE booking_quotations
            SET quotation_amount = ?, admin_notes = ?,
                quotation_status = 'sent', updated_at = NOW()
            WHERE booking_id = ?
        ")->execute([$quotationAmount, $adminNotes, $bookingId]);
    } else {
        $conn->prepare("
            INSERT INTO booking_quotations
                (booking_id, quotation_amount, admin_notes, quotation_status, created_by)
            VALUES (?, ?, ?, 'sent', ?)
        ")->execute([$bookingId, $quotationAmount, $adminNotes, $changedBy]);
    }
}

$remarks = match ($action) {
    "approve"  => "Quotation sent to client.",
    "reject"   => $adminNotes,
    "complete" => "Service completed. Awaiting payment confirmation.",
    "paid"     => "Payment received. Booking marked as completed.",
    "cancel"   => "Booking cancelled by admin.",
    default    => "",
};

$conn->prepare("
    INSERT INTO booking_history (booking_id, changed_by, old_status, new_status, remarks)
    VALUES (?, ?, ?, ?, ?)
")->execute([$bookingId, $changedBy, $oldStatus, $newStatus, $remarks]);

$conn->commit();

echo json_encode([
    "success"    => true,
    "message"    => "Booking updated successfully.",
    "new_status" => $newStatus,
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