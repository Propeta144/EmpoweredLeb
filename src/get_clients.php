<?php
session_start();
header("Content-Type: application/json");
require_once "../Database.php";

try {
    $db   = new Database();
    $conn = $db->connect();

    $sql = "
    SELECT
        u.user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.account_status,
        u.created_at,
        c.client_id,
        COUNT(b.booking_id)  AS total_bookings,
        MAX(b.updated_at)    AS last_activity
    FROM users u
    INNER JOIN clients c  ON u.user_id   = c.user_id
    LEFT  JOIN bookings b ON c.client_id = b.client_id
    WHERE u.role_id = (
        SELECT role_id FROM roles WHERE role_name = 'client' LIMIT 1
    )
    GROUP BY u.user_id, c.client_id
    ORDER BY u.created_at DESC
    ";

    $stmt = $conn->prepare($sql);
    $stmt->execute();
    $clients = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $total        = count($clients);
    $active       = 0;
    $inactive     = 0;
    $newThisMonth = 0;
    $thisMonth    = (new DateTime())->format('Y-m');

    foreach ($clients as &$c) {
        $c['initials'] = strtoupper(
            substr($c['first_name'], 0, 1) .
            substr($c['last_name'],  0, 1)
        );
        if ($c['account_status'] === 'active') $active++;
        else                                    $inactive++;
        if (substr($c['created_at'], 0, 7) === $thisMonth) $newThisMonth++;
    }

    echo json_encode([
        "success" => true,
        "clients" => $clients,
        "stats"   => [
            "total"          => $total,
            "active"         => $active,
            "inactive"       => $inactive,
            "new_this_month" => $newThisMonth,
        ],
    ]);

} catch (PDOException $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>