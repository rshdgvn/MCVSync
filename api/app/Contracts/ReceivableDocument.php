<?php

namespace App\Contracts;

use Illuminate\Database\Eloquent\Relations\HasMany;

interface ReceivableDocument extends DiscrepancyDocument
{
    public function fresh($with = []);

    public function receivingBranchId(): int;

    public function isReceivable(): bool;

    public function receivingTransactionType(): string;

    public function receivingLines(): HasMany;

    public function markFullyReceived(): void;

    public function closeIfSettled(): bool;
}
