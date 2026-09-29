<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Http\Resources\PurchaseOrderDiscrepancyResource;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderDiscrepancy;
use App\Models\Scopes\BranchScope;
use App\Services\ReceivingService;

class DiscrepancyController extends Controller
{
    public function index(PurchaseOrder $purchaseOrder)
    {
        $this->authorize('view', $purchaseOrder);

        $discrepancies = $purchaseOrder->discrepancies()
            ->with(['item', 'purchaseOrderItem.item', 'resolvedBy.user'])
            ->latest()
            ->get();

        return PurchaseOrderDiscrepancyResource::collection($discrepancies);
    }

    public function resolve(PurchaseOrderDiscrepancy $discrepancy, ReceivingService $service)
    {
        $this->authorize('update', $discrepancy);
        $this->ensureWithinActingBranch($discrepancy);

        $discrepancy = $service->resolveDiscrepancy($discrepancy, request()->user('staff')->employee);

        return new PurchaseOrderDiscrepancyResource($discrepancy->load(['item', 'purchaseOrderItem.item', 'resolvedBy.user']));
    }

    /**
     * PurchaseOrderDiscrepancy has no branch_id of its own — this route
     * resolves it by its own id, not nested under a purchase order route,
     * so it never benefits from PurchaseOrder's BranchScope the way
     * ReceivingController's actions do implicitly. Checked explicitly here
     * so a branch-scoped Purchasing user can't resolve another branch's
     * discrepancy by guessing an id.
     *
     * Looks the parent PO up with BranchScope bypassed on purpose: the
     * whole point of this check is to compare the PO's real branch against
     * the acting user's — a scoped lookup would just return null for a
     * cross-branch PO instead of letting that comparison happen.
     */
    private function ensureWithinActingBranch(PurchaseOrderDiscrepancy $discrepancy): void
    {
        $branchId = $this->currentBranchId();

        if ($branchId === null) {
            return;
        }

        $poBranchId = PurchaseOrder::withoutGlobalScope(BranchScope::class)
            ->whereKey($discrepancy->purchase_order_id)
            ->value('branch_id');

        abort_unless($poBranchId === $branchId, 404);
    }
}
