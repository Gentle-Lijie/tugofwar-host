<?php
require_once dirname(__DIR__) . '/config/database.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $className = trim($_POST['class_name'] ?? '');

    if ($className === '') {
        http_response_code(400);
        echo '班级名称不能为空。';
        exit;
    }

    $stmt = mysqli_prepare($db, 'INSERT INTO `classes` (`class_name`) VALUES (?)');
    if (!$stmt) {
        http_response_code(500);
        echo '数据库预处理失败: ' . mysqli_error($db);
        exit;
    }

    mysqli_stmt_bind_param($stmt, 's', $className);
    $success = mysqli_stmt_execute($stmt);
    mysqli_stmt_close($stmt);

    if ($success) {
        echo '班级添加成功';
    } else {
        http_response_code(500);
        echo '错误: ' . mysqli_error($db);
    }
} else {
    http_response_code(405);
    header('Allow: POST');
}
