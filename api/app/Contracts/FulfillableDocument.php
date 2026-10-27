<?php

namespace App\Contracts;

use Illuminate\Database\Eloquent\Relations\HasMany;

interface FulfillableDocument
{
    public function getMorphClass();

    public function getKey();

    public function newQueryWithoutScopes();

    public function fulfillingBranchId(): int;

    public function isFulfillable(): bool;

    public function fulfillmentTransactionType(): string;

    public function fulfillmentLines(): HasMany;
}
