<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use DateTimeInterface;

final class BusinessDate
{
    public static function today(): CarbonImmutable
    {
        return CarbonImmutable::now(config('mcvsync.business_timezone'))->startOfDay();
    }

    public static function todayString(): string
    {
        return self::today()->toDateString();
    }

    public static function daysFromToday(DateTimeInterface|string $date): int
    {
        $day = CarbonImmutable::parse(is_string($date) ? $date : $date->format('Y-m-d'), 'UTC');
        $today = CarbonImmutable::parse(self::todayString(), 'UTC');

        return (int) $today->diffInDays($day, false);
    }
}
