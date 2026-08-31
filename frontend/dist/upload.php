<?php
// CricZone auction image uploader — lives on Hostinger next to the website.
// The admin's browser POSTs a player photo / team logo here; we validate it,
// store it under /uploads/auction/, and return its public URL. That URL is
// then saved with the player/team on the Render backend.

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_FILES['file'])) {
  http_response_code(400);
  echo json_encode(['error' => 'No file uploaded']);
  exit;
}

$file = $_FILES['file'];
if ($file['error'] !== UPLOAD_ERR_OK) {
  http_response_code(400);
  echo json_encode(['error' => 'Upload error']);
  exit;
}
if ($file['size'] > 5 * 1024 * 1024) {
  http_response_code(400);
  echo json_encode(['error' => 'Image must be under 5MB']);
  exit;
}

// Validate by real MIME type (not the client-supplied name/extension).
$allowed = [
  'image/jpeg' => 'jpg',
  'image/png'  => 'png',
  'image/webp' => 'webp',
  'image/gif'  => 'gif',
];
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);
if (!isset($allowed[$mime])) {
  http_response_code(400);
  echo json_encode(['error' => 'Only image files are allowed']);
  exit;
}
$ext = $allowed[$mime];

// Store under ./uploads/auction/ (created on first use).
$dir = __DIR__ . '/uploads/auction';
if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
  http_response_code(500);
  echo json_encode(['error' => 'Could not create upload folder']);
  exit;
}

$name = bin2hex(random_bytes(8)) . '.' . $ext;
$dest = $dir . '/' . $name;
if (!move_uploaded_file($file['tmp_name'], $dest)) {
  http_response_code(500);
  echo json_encode(['error' => 'Failed to save image']);
  exit;
}

$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'];
$url = $scheme . '://' . $host . '/uploads/auction/' . $name;
echo json_encode(['url' => $url]);
