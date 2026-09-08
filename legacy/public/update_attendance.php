<?php
require_once dirname(__DIR__) . '/config/database.php';

yieldJSON();

function yieldJSON(): void
{
    global $db;

    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        respond(400, ['success' => false, 'message' => '请求体必须为 JSON']);
    }

    $matchId   = intval($payload['match_id'] ?? 0);
    $studentId = intval($payload['student_id'] ?? 0);
    $checkedIn = intval($payload['checked_in'] ?? 0) === 1 ? 1 : 0;

    if ($matchId <= 0 || $studentId <= 0) {
        respond(400, ['success' => false, 'message' => '缺少有效的比赛或学生编号']);
    }

    $existsStmt = mysqli_prepare($db, 'SELECT 1 FROM `attendance` WHERE `match_id` = ? AND `student_id` = ? LIMIT 1');
    if (!$existsStmt) {
        respond(500, ['success' => false, 'message' => '数据库预处理失败: ' . mysqli_error($db)]);
    }

    mysqli_stmt_bind_param($existsStmt, 'ii', $matchId, $studentId);
    mysqli_stmt_execute($existsStmt);
    mysqli_stmt_store_result($existsStmt);
    $recordExists = mysqli_stmt_num_rows($existsStmt) > 0;
    mysqli_stmt_free_result($existsStmt);
    mysqli_stmt_close($existsStmt);

    if ($recordExists) {
        $stmt = mysqli_prepare($db, 'UPDATE `attendance` SET `checked_in` = ? WHERE `match_id` = ? AND `student_id` = ?');
        if (!$stmt) {
            respond(500, ['success' => false, 'message' => '数据库预处理失败: ' . mysqli_error($db)]);
        }

        mysqli_stmt_bind_param($stmt, 'iii', $checkedIn, $matchId, $studentId);
        $success = mysqli_stmt_execute($stmt);
        $error = mysqli_error($db);
        mysqli_stmt_close($stmt);
    } else {
        $stmt = mysqli_prepare($db, 'INSERT INTO `attendance` (`match_id`, `student_id`, `checked_in`) VALUES (?, ?, ?)');
        if (!$stmt) {
            respond(500, ['success' => false, 'message' => '数据库预处理失败: ' . mysqli_error($db)]);
        }

        mysqli_stmt_bind_param($stmt, 'iii', $matchId, $studentId, $checkedIn);
        $success = mysqli_stmt_execute($stmt);
        $error = mysqli_error($db);
        mysqli_stmt_close($stmt);
    }

    if (!$success) {
        respond(500, ['success' => false, 'message' => '更新失败: ' . $error]);
    }

    respond(200, [
        'success' => true,
        'match_id' => $matchId,
        'student_id' => $studentId,
        'checked_in' => $checkedIn
    ]);
}

function respond(int $status, array $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}
