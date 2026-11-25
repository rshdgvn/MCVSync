<?php

namespace App\Contracts;

use Illuminate\Database\Eloquent\Relations\MorphMany;

interface DiscrepancyDocument
{
    public function getMorphClass();

    public function getKey();

    public function newQueryWithoutScopes();

    public function discrepancies(): MorphMany;

    public function involvesBranch(int $branchId): bool;

    public function documentNumber(): string;
}
