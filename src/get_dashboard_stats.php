<?php
// Suppress PHP error HTML output — errors returned as JSON instead
ini_set('display_errors', 0);
error_reporting(0);

header('Content-Type: application/json');

try {

require_once '../Database.php';

$db   = new Database();
$conn = $db->connect();

$today         = date('Y-m-d');
$weekStart     = date('Y-m-d', strtotime('monday this week'));
$weekEnd       = date('Y-m-d', strtotime('sunday this week'));
$lastWeekStart = date('Y-m-d', strtotime('monday last week'));
$lastWeekEnd   = date('Y-m-d', strtotime('sunday last week'));
$monthStart    = date('Y-m-01');
$monthEnd      = date('Y-m-t');
$lastMonthStart = date('Y-m-01', strtotime('first day of last month'));
$lastMonthEnd   = date('Y-m-t',  strtotime('last day of last month'));
$year          = date('Y');

// ── Today's bookings (excluding cancelled) ────────────────
$s = $conn->prepare("
    SELECT
        COUNT(*) AS total,
        SUM(status IN ('confirmed','approved')) AS confirmed_count,
        SUM(status = 'pending')                 AS pending_count
    FROM bookings
    WHERE booking_date = ?
      AND status != 'cancelled'
");
$s->execute([$today]);
$todayRow = $s->fetch(PDO::FETCH_ASSOC);

// ── This week (excluding cancelled) ───────────────────────
$s = $conn->prepare("
    SELECT COUNT(*) FROM bookings
    WHERE booking_date BETWEEN ? AND ?
      AND status != 'cancelled'
");
$s->execute([$weekStart, $weekEnd]);
$thisWeek = (int) $s->fetchColumn();

// ── Last week (excluding cancelled) ───────────────────────
$s = $conn->prepare("
    SELECT COUNT(*) FROM bookings
    WHERE booking_date BETWEEN ? AND ?
      AND status != 'cancelled'
");
$s->execute([$lastWeekStart, $lastWeekEnd]);
$lastWeek = (int) $s->fetchColumn();

// ── Status counts (all time) ──────────────────────────────
$s = $conn->query("
    SELECT status, COUNT(*) AS cnt
    FROM bookings
    GROUP BY status
");
$statusMap = [];
foreach ($s->fetchAll(PDO::FETCH_ASSOC) as $r) {
    $statusMap[$r['status']] = (int) $r['cnt'];
}

$pending   = $statusMap['pending']   ?? 0;
$waiting   = $statusMap['waiting']   ?? 0;
$confirmed = ($statusMap['confirmed'] ?? 0) + ($statusMap['approved'] ?? 0);
$completed = $statusMap['completed'] ?? 0;
$cancelled = $statusMap['cancelled'] ?? 0;

// ── Confirmed this week ───────────────────────────────────
$s = $conn->prepare("
    SELECT COUNT(*) FROM bookings
    WHERE status IN ('confirmed','approved')
      AND booking_date BETWEEN ? AND ?
");
$s->execute([$weekStart, $weekEnd]);
$confirmedThisWeek = (int) $s->fetchColumn();

// ── Total clients ─────────────────────────────────────────
$s = $conn->query("SELECT COUNT(*) FROM clients");
$totalClients = (int) $s->fetchColumn();

// ── Active clients this month ─────────────────────────────
$s = $conn->prepare("
    SELECT COUNT(DISTINCT client_id) FROM bookings
    WHERE booking_date BETWEEN ? AND ?
");
$s->execute([$monthStart, $monthEnd]);
$activeClients = (int) $s->fetchColumn();

// ── Total revenue (lifetime — completed bookings only) ────
$s = $conn->query("
    SELECT COALESCE(SUM(bq.quotation_amount), 0)
    FROM booking_quotations bq
    JOIN bookings b ON b.booking_id = bq.booking_id
    WHERE b.status = 'completed'
      AND bq.quotation_status = 'accepted'
");
$totalRevenue = (float) $s->fetchColumn();

// ── Monthly revenue (completed bookings this month) ───────
$s = $conn->prepare("
    SELECT COALESCE(SUM(bq.quotation_amount), 0)
    FROM booking_quotations bq
    JOIN bookings b ON b.booking_id = bq.booking_id
    WHERE b.status = 'completed'
      AND bq.quotation_status = 'accepted'
      AND b.booking_date BETWEEN ? AND ?
");
$s->execute([$monthStart, $monthEnd]);
$monthlyRevenue = (float) $s->fetchColumn();

// ── Last month revenue (completed bookings, for MoM trend) 
$s = $conn->prepare("
    SELECT COALESCE(SUM(bq.quotation_amount), 0)
    FROM booking_quotations bq
    JOIN bookings b ON b.booking_id = bq.booking_id
    WHERE b.status = 'completed'
      AND bq.quotation_status = 'accepted'
      AND b.booking_date BETWEEN ? AND ?
");
$s->execute([$lastMonthStart, $lastMonthEnd]);
$lastMonthRevenue = (float) $s->fetchColumn();

// ── Bookings per month (current year, months 1–12) ────────
$s = $conn->prepare("
    SELECT MONTH(booking_date) AS m, COUNT(*) AS total
    FROM bookings
    WHERE YEAR(booking_date) = ?
    GROUP BY m
    ORDER BY m
");
$s->execute([$year]);
$rawBPM = $s->fetchAll(PDO::FETCH_ASSOC);
$bookingsPerMonth = array_fill(1, 12, 0);
foreach ($rawBPM as $r) {
    $bookingsPerMonth[(int) $r['m']] = (int) $r['total'];
}

// ── Revenue per month (completed bookings, current year) ─
$s = $conn->prepare("
    SELECT MONTH(b.booking_date) AS m,
           COALESCE(SUM(bq.quotation_amount), 0) AS total
    FROM booking_quotations bq
    JOIN bookings b ON b.booking_id = bq.booking_id
    WHERE b.status = 'completed'
      AND bq.quotation_status = 'accepted'
      AND YEAR(b.booking_date) = ?
    GROUP BY m
    ORDER BY m
");
$s->execute([$year]);
$rawRPM = $s->fetchAll(PDO::FETCH_ASSOC);
$revenuePerMonth = array_fill(1, 12, 0);
foreach ($rawRPM as $r) {
    $revenuePerMonth[(int) $r['m']] = (float) $r['total'];
}

// ── Most requested services (top 4 by booking count) ─────
$s = $conn->query("
    SELECT s.service_name, COUNT(b.booking_id) AS total
    FROM bookings b
    JOIN services s ON s.service_id = b.service_id
    GROUP BY b.service_id, s.service_name
    ORDER BY total DESC
    LIMIT 4
");
$mostRequested = $s->fetchAll(PDO::FETCH_ASSOC);

// ── Response ──────────────────────────────────────────────
echo json_encode([
    'success'           => true,
    'today'             => [
        'total'     => (int) ($todayRow['total']          ?? 0),
        'confirmed' => (int) ($todayRow['confirmed_count'] ?? 0),
        'pending'   => (int) ($todayRow['pending_count']   ?? 0),
    ],
    'thisWeek'          => $thisWeek,
    'lastWeek'          => $lastWeek,
    'pending'           => $pending,
    'waiting'           => $waiting,
    'confirmed'         => $confirmed,
    'confirmedThisWeek' => $confirmedThisWeek,
    'completed'         => $completed,
    'cancelled'         => $cancelled,
    'totalClients'      => $totalClients,
    'activeClients'     => $activeClients,
    'totalRevenue'      => $totalRevenue,
    'monthlyRevenue'    => $monthlyRevenue,
    'lastMonthRevenue'  => $lastMonthRevenue,
    'bookingsPerMonth'  => $bookingsPerMonth,
    'revenuePerMonth'   => $revenuePerMonth,
    'mostRequested'     => $mostRequested,
    'statusMap'         => $statusMap,
]);

} catch (Throwable $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
        'file'    => $e->getFile(),
        'line'    => $e->getLine(),
    ]);
}