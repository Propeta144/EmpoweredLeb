<?php

session_start();

header("Content-Type: application/json");

require_once "../Database.php";

try{

    $db = new Database();
    $conn = $db->connect();

    $sql = "
    SELECT
        b.booking_id,
        b.booking_date,
        b.status,
        b.location_type,
        b.created_at,
        u.first_name,
        u.last_name,
        u.email,
        s.service_name,
        sc.category_name,
        sts.slot_label,
        sm.icon_class AS mode_icon
    FROM bookings b
    INNER JOIN clients c  ON b.client_id  = c.client_id
    INNER JOIN users u    ON c.user_id    = u.user_id
    INNER JOIN services s ON b.service_id = s.service_id
    INNER JOIN service_categories sc ON s.category_id = sc.category_id
    LEFT  JOIN service_time_slots sts ON b.slot_id     = sts.slot_id
    LEFT  JOIN service_modes sm
        ON  sm.service_id = s.service_id
        AND LOWER(sm.mode_name) = LOWER(b.location_type)
    ORDER BY b.created_at DESC
    ";

    $stmt = $conn->prepare($sql);

    $stmt->execute();

    $bookings =
        $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach($bookings as &$booking){

        $booking['client_name'] =
            $booking['first_name']
            . " " .
            $booking['last_name'];

        $booking['initials'] =
            strtoupper(
                substr(
                    $booking['first_name'],
                    0,
                    1
                )
                .
                substr(
                    $booking['last_name'],
                    0,
                    1
                )
            );
    }

    echo json_encode([
        "success" => true,
        "bookings" => $bookings
    ]);

}catch(PDOException $e){

    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]);
}
?>