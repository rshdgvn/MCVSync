<?php

return [

    'business_timezone' => env('BUSINESS_TIMEZONE', 'Asia/Manila'),

    'company' => [
        'name' => env('COMPANY_NAME') ?: env('APP_NAME', 'MCVSync'),
        'address' => env('COMPANY_ADDRESS') ?: null,
        'phone' => env('COMPANY_PHONE') ?: null,
        'tin' => env('COMPANY_TIN') ?: null,
    ],

];
