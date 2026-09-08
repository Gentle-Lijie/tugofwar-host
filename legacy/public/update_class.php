<?php
require_once dirname(__DIR__) . '/config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    exit;
}

$classId   = intval($_POST['class_id'] ?? 0);
$className = trim($_POST['class_name'] ?? '');
$studentsRaw = $_POST['students'] ?? '';

if ($classId <= 0 || $className === '') {
    http_response_code(400);
    echo '班级编号和名称为必填项。';
    exit;
}

$studentNames = array_filter(array_map(static function ($name) {
    return trim($name);
}, preg_split('/\r?\n/', $studentsRaw ?? '', -1, PREG_SPLIT_NO_EMPTY)));

mysqli_begin_transaction($db);

try {
    $updateClassStmt = mysqli_prepare($db, 'UPDATE `classes` SET `class_name` = ? WHERE `id` = ?');
    if (!$updateClassStmt) {
        throw new RuntimeException('更新班级名称失败: ' . mysqli_error($db));
    }
    mysqli_stmt_bind_param($updateClassStmt, 'si', $className, $classId);
    mysqli_stmt_execute($updateClassStmt);
    mysqli_stmt_close($updateClassStmt);

    $deleteStudentsStmt = mysqli_prepare($db, 'DELETE FROM `students` WHERE `class_id` = ?');
    if (!$deleteStudentsStmt) {
        throw new RuntimeException('清空原学生数据失败: ' . mysqli_error($db));
    }
    mysqli_stmt_bind_param($deleteStudentsStmt, 'i', $classId);
    mysqli_stmt_execute($deleteStudentsStmt);
    mysqli_stmt_close($deleteStudentsStmt);

    if (!empty($studentNames)) {
        $insertStudentStmt = mysqli_prepare($db, 'INSERT INTO `students` (`class_id`, `name`) VALUES (?, ?)');
        if (!$insertStudentStmt) {
            throw new RuntimeException('准备插入学生数据失败: ' . mysqli_error($db));
        }
        foreach ($studentNames as $studentName) {
            mysqli_stmt_bind_param($insertStudentStmt, 'is', $classId, $studentName);
            mysqli_stmt_execute($insertStudentStmt);
        }
        mysqli_stmt_close($insertStudentStmt);
    }

    mysqli_commit($db);
} catch (Throwable $exception) {
    mysqli_rollback($db);
    http_response_code(500);
    echo $exception->getMessage();
    exit;
}

if (isset($_SERVER['HTTP_REFERER'])) {
    header('Location: ' . $_SERVER['HTTP_REFERER']);
} else {
    header('Location: class_manage.php');
}
exit;
