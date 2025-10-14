<?php
require_once dirname(__DIR__) . '/config/database.php';

$class_id = intval($_GET['id'] ?? 0);
if ($class_id <= 0) {
    http_response_code(400);
    echo '班级不存在';
    exit;
}

$stmt = mysqli_prepare($db, 'SELECT * FROM `classes` WHERE `id` = ?');
if (!$stmt) {
    http_response_code(500);
    echo '无法获取班级信息';
    exit;
}

mysqli_stmt_bind_param($stmt, 'i', $class_id);
mysqli_stmt_execute($stmt);
$class_result = mysqli_stmt_get_result($stmt);
$class = mysqli_fetch_assoc($class_result);
mysqli_stmt_close($stmt);

if (!$class) {
    http_response_code(404);
    echo '未找到班级';
    exit;
}

$query_students = mysqli_prepare($db, 'SELECT `name` FROM `students` WHERE `class_id` = ? ORDER BY `id` ASC');
$students_names = [];
if ($query_students) {
    mysqli_stmt_bind_param($query_students, 'i', $class_id);
    mysqli_stmt_execute($query_students);
    mysqli_stmt_bind_result($query_students, $student_name);
    while (mysqli_stmt_fetch($query_students)) {
        $students_names[] = $student_name;
    }
    mysqli_stmt_close($query_students);
}

$students_text = implode("\n", $students_names);
?>

<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <title>编辑班级</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #FAF6EF;
            color: #10263B;
            margin: 0;
            padding: 0;
        }

        h2, h3 {
            color: #10263B;
        }

        h2 {
            background-color: #33AFCD;
            padding: 10px;
            margin: 0;
        }

        form {
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            padding: 20px;
            margin: 20px auto;
            max-width: 600px;
        }

        label {
            font-size: 16px;
            color: #10263B;
            display: block;
            margin-bottom: 8px;
        }

        input[type="text"], textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #707D89;
            border-radius: 4px;
            margin-bottom: 20px;
            font-size: 14px;
            box-sizing: border-box;
        }

        button {
            background-color: #009BC1;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
        }

        button:hover {
            background-color: #33AFCD;
        }

        textarea {
            resize: vertical;
            font-family: 'Courier New', Courier, monospace;
        }

        .student-list {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 10px;
            margin-top: 20px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }

        .student-list ul {
            list-style-type: none;
            padding: 0;
        }

        .student-list li {
            padding: 8px;
            background-color: #F3F4F5;
            margin-bottom: 5px;
            border-radius: 4px;
        }

        .back-to-home {
            z-index: 999;
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 20px;
            background-color: #10263B;
            color: white;
            font-size: 1.5em;
            border-radius: 50px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
            text-decoration: none;
            display: inline-block;
            text-align: center;
            transition: background-color 0.3s ease, transform 0.3s ease;
        }

        .back-to-home:hover {
            background-color: #33AFCD;
            transform: scale(1.1);
        }

        .back-to-home:active {
            background-color: #405162;
            transform: scale(1);
        }
    </style>
</head>
<body>
    <h2>编辑班级: <?= htmlspecialchars($class['class_name']) ?></h2>

    <form action="update_class.php" method="POST">
        <input type="hidden" name="class_id" value="<?= (int)$class['id'] ?>">

        <label for="class_name">班级名称:</label>
        <input type="text" name="class_name" value="<?= htmlspecialchars($class['class_name']) ?>" required>

        <h3>班级学生（姓名按行分开）</h3>
        <textarea name="students" rows="10" required><?= htmlspecialchars($students_text) ?></textarea>

        <button type="submit">更新班级</button>
    </form>

    <div class="student-list">
        <h3>班级学生列表</h3>
        <ul>
            <?php foreach ($students_names as $student_name): ?>
                <li><?= htmlspecialchars($student_name) ?></li>
            <?php endforeach; ?>
        </ul>
    </div>

    <a href="index.php" class="back-to-home">回首页</a>
    <footer style="position:fixed; left:0; bottom:0; width:100%; background:#fff; border-top:1px solid #e0e6ed; box-shadow:0 -2px 8px rgba(52,152,219,0.08); padding:12px 0; color:#666; font-size:1em; text-align:center; z-index:999;">
        For tech support: Contact Lijie ZHOU (20809020 <a href="mailto:scylz12@nottingham.edu.cn" style="color:#2980b9;text-decoration:none;">scylz12@nottingham.edu.cn</a>)
        &nbsp;|&nbsp; 
    </footer>
</body>
</html>
