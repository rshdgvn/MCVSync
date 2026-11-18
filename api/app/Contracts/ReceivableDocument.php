<?php

namespace App\Contracts;

use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

interface ReceivableDocument
{
    public function getMorphClass();

    public function getKey();

    public function fresh($with = []);

    public function newQueryWithoutScopes();

    public function receivingBranchId(): int;

    public function isReceivable(): bool;

    public function receivingTransactionType(): string;

    public function receivingLines(): HasMany;

    public function discrepancies(): MorphMany;

    public function markFullyReceived(): void;

    public function closeIfSettled(): bool;

    public function involvesBranch(int $branchId): bool;

    public function documentNumber(): string;
}
