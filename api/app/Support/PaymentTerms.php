<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use DateTimeInterface;

final class PaymentTerms
{
    public const DEFAULT_TERMS = 'COD';

    public static function label(?string $terms): string
    {
        return filled($terms) ? trim($terms) : self::DEFAULT_TERMS;
    }

    public static function dueDate(?string $terms, ?DateTimeInterface $from = null): string
    {
        $days = preg_match('/\d+/', (string) $terms, $match) === 1 ? (int) $match[0] : 0;
        $start = $from === null ? BusinessDate::today() : CarbonImmutable::parse($from->format('Y-m-d'));

        return $start->addDays($days)->toDateString();
    }
}
