<?php

session_start();

header("Content-Type: application/json");

require_once "../Database.php";

if(!isset($_SESSION['user_id'])){

    echo json_encode([
        "success" => false,
        "message" => "Please login first."
    ]);

    exit;
}

$db = new Database();
$conn = $db->connect();

try{

    $user_id = $_SESSION['user_id'];

    // GET CLIENT
    $client_sql = "
    SELECT *
    FROM clients
    WHERE user_id = ?
    ";

    $stmt = $conn->prepare($client_sql);
    $stmt->execute([$user_id]);

    $client = $stmt->fetch(PDO::FETCH_ASSOC);

    if(!$client){

        $insert_client = "
        INSERT INTO clients(user_id)
        VALUES(?)
        ";

        $stmt2 = $conn->prepare($insert_client);
        $stmt2->execute([$user_id]);

        $client_id = $conn->lastInsertId();

    }else{
        $client_id = $client['client_id'];
    }

    // INSERT BOOKING
    $booking_sql = "
    INSERT INTO bookings(
        client_id,
        service_id,
        booking_date,
        slot_id,
        location_type,
        concern_details
    )
    VALUES(?,?,?,?,?,?)
    ";

    $stmt3 = $conn->prepare($booking_sql);

    $stmt3->execute([

        $client_id,
        $_POST['service_id'],
        $_POST['booking_date'],
        $_POST['slot_id'],
        $_POST['location_type'],
        $_POST['concern_details']

    ]);

    $booking_id =
        $conn->lastInsertId();

    // FILE UPLOADS
    if(isset($_FILES['files'])){

        $uploadDir =
            "../uploads/";

        if(!file_exists($uploadDir)){
            mkdir($uploadDir);
        }

        foreach($_FILES['files']['tmp_name'] as $key => $tmpName){

            $fileName =
                time() . "_" .
                $_FILES['files']['name'][$key];

            move_uploaded_file(
                $tmpName,
                $uploadDir . $fileName
            );

            $file_sql = "
            INSERT INTO booking_files(
                booking_id,
                file_name
            )
            VALUES(?,?)
            ";

            $stmt4 =
                $conn->prepare($file_sql);

            $stmt4->execute([
                $booking_id,
                $fileName
            ]);
        }
    }

    echo json_encode([
        "success" => true,
        "booking_id" => $booking_id
    ]);

}catch(PDOException $e){

    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]);
}