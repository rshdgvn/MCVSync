<?php

namespace App\Models\Concerns;

use App\Contracts\ReceivableLine;

trait ClosesWhenSettled
{
    public function closeIfSettled(): bool
    {
        $settled = $this->receivingLines()->get()->every(fn (ReceivableLine $line) => $line->isSettled());

        if (! $this->isReceivable() || ! $settled) {
            return false;
        }

        $this->markFullyReceived();

        return true;
    }
}
