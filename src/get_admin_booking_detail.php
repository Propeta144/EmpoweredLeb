<?php
header("Content-Type: application/json");
require_once "../Database.php";

try {
    $bookingId = $_GET['booking_id'];
    $db   = new Database();
    $conn = $db->connect();

    $sql = "
    SELECT
        b.*,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.created_at AS user_created_at,
        s.service_name,
        s.icon_class,
        sc.category_name,
        sts.slot_label,
        q.quotation_amount,
        q.admin_notes,
        sm.icon_class AS mode_icon,
        (
            SELECT COUNT(*)
            FROM bookings b2
            WHERE b2.client_id = b.client_id
              AND b2.status != 'cancelled'
        ) AS total_bookings
    FROM bookings b
    INNER JOIN clients c     ON b.client_id  = c.client_id
    INNER JOIN users u       ON c.user_id    = u.user_id
    INNER JOIN services s    ON b.service_id = s.service_id
    INNER JOIN service_categories sc ON s.category_id = sc.category_id
    LEFT  JOIN service_time_slots sts ON b.slot_id    = sts.slot_id
    LEFT  JOIN booking_quotations q   ON b.booking_id = q.booking_id
    LEFT  JOIN service_modes sm
           ON  sm.service_id = s.service_id
           AND LOWER(sm.mode_name) = LOWER(b.location_type)
    WHERE b.booking_id = ?
    ";
    $stmt = $conn->prepare($sql);
    $stmt->execute([$bookingId]);
    $booking = $stmt->fetch(PDO::FETCH_ASSOC);

    $filesStmt = $conn->prepare("SELECT * FROM booking_files WHERE booking_id = ?");
    $filesStmt->execute([$bookingId]);
    $files = $filesStmt->fetchAll(PDO::FETCH_ASSOC);

    // ── history for progress tracker ──────────────────────────
    $histStmt = $conn->prepare("
        SELECT bh.new_status, bh.changed_at, bh.remarks,
               CONCAT(u2.first_name,' ',u2.last_name) AS actor_name
        FROM booking_history bh
        INNER JOIN users u2 ON bh.changed_by = u2.user_id
        WHERE bh.booking_id = ?
        ORDER BY bh.changed_at ASC
    ");
    $histStmt->execute([$bookingId]);
    $history = $histStmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "success" => true,
        "booking" => $booking,
        "files"   => $files,
        "history" => $history,
    ]);

} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>