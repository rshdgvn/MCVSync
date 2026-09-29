<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['name', 'contact_person', 'phone', 'email', 'address', 'is_active'])]
class Supplier extends Model
{
    use HasFactory;

    /**
     * Eloquent's create() does not re-read DB-level column defaults back
     * into the in-memory model after insert — without this, creating a
     * supplier without explicitly passing is_active would correctly
     * persist `true` to the database but return `null` for it in that
     * same response.
     */
    protected $attributes = [
        'is_active' => true,
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }
}
