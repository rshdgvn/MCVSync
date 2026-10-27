<?php

namespace App\Services\Concerns;

use Illuminate\Auth\Access\AuthorizationException;

trait EnforcesActingBranch
{
    private function ensureActingBranch(?int $actingBranchId, int $requiredBranchId, string $message): void
    {
        if ($actingBranchId !== null && $actingBranchId !== $requiredBranchId) {
            throw new AuthorizationException($message);
        }
    }
}
