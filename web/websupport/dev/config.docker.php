<?php
return [
  'db' => ['host'=>'db','name'=>'pod','user'=>'pod','pass'=>'pod','charset'=>'utf8mb4'],
  'session_secret' => 'test-secret-0123456789abcdef',
  'setup_token' => 'tok',
  'cron_token' => 'crontok',
  'uploads_dir' => __DIR__ . '/../uploads',
  'uploads_url' => '/uploads',
  'resend_api_key' => '', 'inquiry_from' => 'Bungalovy Classic <info@podhajska.net>', 'inquiry_to' => 'info@podhajska.net', 'inquiry_webhook_url' => '',
];
