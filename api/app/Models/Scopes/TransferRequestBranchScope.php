<?php

namespace App\Models\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

class TransferRequestBranchScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        if (! app()->bound('currentBranchId')) {
            return;
        }

        $branchId = app('currentBranchId');

        $builder->where(function (Builder $query) use ($model, $branchId) {
            $query->where($model->qualifyColumn('requesting_branch_id'), $branchId)
                ->orWhere($model->qualifyColumn('fulfilling_branch_id'), $branchId);
        });
    }
}
