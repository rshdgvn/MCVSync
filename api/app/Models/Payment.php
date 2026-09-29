<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'reference_type',
    'reference_id',
    'order_total',
    'payment_terms',
    'expected_payment_date',
    'status',
    'method',
    'date_received',
    'reference_note',
    'approved_by',
    'approved_at',
])]
class Payment extends Model
{
    use HasFactory;

    protected $attributes = [
        'status' => 'payment_due',
    ];

    protected function casts(): array
    {
        return [
            'order_total' => 'decimal:2',
            'expected_payment_date' => 'date',
            'date_received' => 'date',
            'approved_at' => 'datetime',
        ];
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'approved_by');
    }
}
