<?php
require_once dirname(__DIR__) . '/config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    exit;
}

$studentId = intval($_POST['student_id'] ?? 0);
$matchId   = intval($_POST['match_id'] ?? 0);

if ($studentId <= 0 || $matchId <= 0) {
    http_response_code(400);
    echo '无效的学生或比赛编号';
    exit;
}

$stmt = mysqli_prepare($db, 'SELECT `checked_in` FROM `attendance` WHERE `match_id` = ? AND `student_id` = ?');
if ($stmt) {
    mysqli_stmt_bind_param($stmt, 'ii', $matchId, $studentId);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_bind_result($stmt, $checkedIn);
    $recordExists = mysqli_stmt_fetch($stmt);
    mysqli_stmt_close($stmt);
} else {
    $recordExists = false;
}

if ($recordExists) {
    $update = mysqli_prepare($db, 'UPDATE `attendance` SET `checked_in` = NOT `checked_in` WHERE `match_id` = ? AND `student_id` = ?');
    if ($update) {
        mysqli_stmt_bind_param($update, 'ii', $matchId, $studentId);
        mysqli_stmt_execute($update);
        mysqli_stmt_close($update);
    }
} else {
    $insert = mysqli_prepare($db, 'INSERT INTO `attendance` (`match_id`, `student_id`, `checked_in`) VALUES (?, ?, 1)');
    if ($insert) {
        mysqli_stmt_bind_param($insert, 'ii', $matchId, $studentId);
        mysqli_stmt_execute($insert);
        mysqli_stmt_close($insert);
    }
}

$stmt = mysqli_prepare($db, 'SELECT `checked_in` FROM `attendance` WHERE `match_id` = ? AND `student_id` = ?');
if ($stmt) {
    mysqli_stmt_bind_param($stmt, 'ii', $matchId, $studentId);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_bind_result($stmt, $checkedIn);
    if (mysqli_stmt_fetch($stmt)) {
        echo $checkedIn ? '1' : '0';
    }
    mysqli_stmt_close($stmt);
}
