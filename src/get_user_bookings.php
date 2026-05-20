<?php

session_start();

header("Content-Type: application/json");

require_once "../Database.php";

if(!isset($_SESSION['user_id'])){

    echo json_encode([
        "success" => false,
        "message" => "User not logged in."
    ]);

    exit;
}

try{

    $db = new Database();
    $conn = $db->connect();

    $user_id = $_SESSION['user_id'];

    $sql = "
    SELECT

        b.booking_id,
        b.booking_date,
        b.status,
        b.location_type,
        b.created_at,

        s.service_name,
        s.icon_class AS service_icon,

        sc.category_name,

        sts.slot_label,

        sm.icon_class AS mode_icon

    FROM bookings b

    INNER JOIN clients c
    ON b.client_id = c.client_id

    INNER JOIN services s
    ON b.service_id = s.service_id

    INNER JOIN service_categories sc
    ON s.category_id = sc.category_id

    LEFT JOIN service_time_slots sts
    ON b.slot_id = sts.slot_id

    LEFT JOIN service_modes sm
    ON sm.service_id = s.service_id
    AND LOWER(sm.mode_name) = LOWER(b.location_type)

    WHERE c.user_id = ?

    ORDER BY

    CASE

        WHEN b.status = 'approved' THEN 1
        WHEN b.status = 'waiting' THEN 2
        WHEN b.status = 'pending' THEN 3
        WHEN b.status = 'cancelled' THEN 4
        WHEN b.status = 'completed' THEN 5
        ELSE 6

    END,

    b.created_at DESC
    ";

    $stmt = $conn->prepare($sql);

    $stmt->execute([$user_id]);

    $bookings = $stmt->fetchAll(PDO::FETCH_ASSOC);

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