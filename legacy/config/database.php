<?php
$host = getenv('DB_HOST') ?: 'mysql';
$user = getenv('DB_USER') ?: 'root';
$pass = getenv('DB_PASSWORD') ?: '';
$db_name = getenv('DB_NAME') ?: 'rope';

$db = mysqli_connect($host, $user, $pass, $db_name);

if (!$db) {
    http_response_code(500);
    echo '数据库连接失败，请检查配置。';
    exit;
}

mysqli_set_charset($db, 'utf8mb4');
