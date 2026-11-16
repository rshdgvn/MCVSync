<?php

namespace App\Http\Controllers\Staff\Inventory;

use App\Http\Controllers\Controller;
use App\Http\Resources\BatchResource;
use App\Http\Resources\LowStockItemResource;
use App\Models\Batch;
use App\Models\Item;
use App\Services\AlertService;
use Illuminate\Http\Request;

class AlertController extends Controller
{
    public function expiring(Request $request, AlertService $alerts)
    {
        $this->authorize('viewAny', Batch::class);

        return BatchResource::collection(
            $alerts->expiringBatches($this->currentBranchId(), $this->perPage($request)),
        );
    }

    public function lowStock(Request $request, AlertService $alerts)
    {
        $this->authorize('viewAny', Item::class);

        $branchId = $this->currentBranchId();

        return LowStockItemResource::collection($alerts->lowStockItems($branchId, $this->perPage($request)))
            ->additional(['summary' => $alerts->lowStockSummary($branchId)]);
    }
}
