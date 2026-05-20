<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once '../Database.php';

$db = new Database();
$conn = $db->connect();

// ── Params ──────────────────────────────────────────────
$view      = $_GET['view']     ?? 'week';   // day | week | month
$date      = $_GET['date']     ?? date('Y-m-d'); // anchor date
$statuses  = $_GET['statuses'] ?? 'pending,waiting,approved,confirmed,awaiting_payment';
$statusArr = array_filter(array_map('trim', explode(',', $statuses)));

// ── Date range by view ──────────────────────────────────
try {
    $anchor = new DateTime($date);
} catch (Exception $e) {
    $anchor = new DateTime();
}

switch ($view) {
    case 'day':
        $start = (clone $anchor)->setTime(0, 0, 0);
        $end   = (clone $anchor)->setTime(23, 59, 59);
        break;
    case 'month':
        $start = new DateTime($anchor->format('Y-m-01 00:00:00'));
        $end   = new DateTime($anchor->format('Y-m-t 23:59:59'));
        break;
    case 'week':
    default:
        // Week starting Monday
        $dow   = (int)$anchor->format('N'); // 1=Mon … 7=Sun
        $start = (clone $anchor)->modify('-' . ($dow - 1) . ' days')->setTime(0, 0, 0);
        $end   = (clone $start)->modify('+6 days')->setTime(23, 59, 59);
        break;
}

$startStr = $start->format('Y-m-d');
$endStr   = $end->format('Y-m-d');

// ── Build status placeholders ───────────────────────────
$allowed = ['pending','waiting','approved','confirmed','awaiting_payment','completed','cancelled'];
$statusArr = array_intersect($statusArr, $allowed);

if (empty($statusArr)) {
    echo json_encode(['success' => false, 'error' => 'No valid statuses provided']);
    exit;
}

$placeholders = implode(',', array_fill(0, count($statusArr), '?'));

// ── Query ───────────────────────────────────────────────
$sql = "
    SELECT
        b.booking_id,
        b.booking_date,
        b.status,
        b.location_type,
        b.concern_details,
        b.created_at,

        -- Time slot
        ts.slot_label,
        ts.slot_id,

        -- Client
        u.first_name,
        u.last_name,
        u.email,
        u.phone,

        -- Service
        s.service_name,
        s.icon_class   AS service_icon,

        -- Quotation (latest)
        bq.quotation_amount,
        bq.quotation_status

    FROM bookings b

    INNER JOIN clients   cl ON cl.client_id  = b.client_id
    INNER JOIN users      u ON u.user_id      = cl.user_id
    INNER JOIN services   s ON s.service_id   = b.service_id
    LEFT  JOIN service_time_slots ts ON ts.slot_id = b.slot_id
    LEFT  JOIN (
        SELECT booking_id, quotation_amount, quotation_status
        FROM booking_quotations
        WHERE (booking_id, created_at) IN (
            SELECT booking_id, MAX(created_at)
            FROM booking_quotations
            GROUP BY booking_id
        )
    ) bq ON bq.booking_id = b.booking_id

    WHERE b.booking_date BETWEEN ? AND ?
      AND b.status IN ($placeholders)

    ORDER BY b.booking_date ASC, ts.slot_id ASC
";

$params = array_merge([$startStr, $endStr], array_values($statusArr));

$stmt = $conn->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

// ── Shape the response ──────────────────────────────────
$bookings = [];
foreach ($rows as $row) {
    $bookings[] = [
        'booking_id'        => (int)$row['booking_id'],
        'booking_date'      => $row['booking_date'],
        'status'            => $row['status'],
        'location_type'     => $row['location_type'],
        'concern_details'   => $row['concern_details'],
        'created_at'        => $row['created_at'],
        'slot_id'           => $row['slot_id'] ? (int)$row['slot_id'] : null,
        'slot_label'        => $row['slot_label'],
        'client_name'       => trim($row['first_name'] . ' ' . $row['last_name']),
        'client_email'      => $row['email'],
        'client_phone'      => $row['phone'],
        'service_name'      => $row['service_name'],
        'service_icon'      => $row['service_icon'],
        'quotation_amount'  => $row['quotation_amount'],
        'quotation_status'  => $row['quotation_status'],
    ];
}

echo json_encode([
    'success'   => true,
    'view'       => $view,
    'range_start'=> $startStr,
    'range_end'  => $endStr,
    'count'      => count($bookings),
    'bookings'   => $bookings,
]);