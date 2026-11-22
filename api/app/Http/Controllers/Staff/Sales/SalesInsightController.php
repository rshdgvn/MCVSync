<?php

namespace App\Http\Controllers\Staff\Sales;

use App\Http\Controllers\Controller;
use App\Http\Resources\SalesExpiryAlertResource;
use App\Http\Resources\SalesItemResource;
use App\Models\ClientOrderForm;
use App\Services\AlertService;
use App\Services\ItemCatalogService;
use App\Services\SalesAnalyticsService;
use Illuminate\Http\Request;

class SalesInsightController extends Controller
{
    public function expiryAlerts(Request $request, AlertService $alerts)
    {
        $this->authorize('viewAny', ClientOrderForm::class);

        return SalesExpiryAlertResource::collection($alerts->expiringItemsByBranch($this->currentBranchId(), $this->perPage($request)));
    }

    public function items(Request $request, ItemCatalogService $catalog)
    {
        $this->authorize('create', ClientOrderForm::class);

        return SalesItemResource::collection(
            $catalog->activeItemsQuery($request->filled('search') ? (string) $request->string('search') : null, null)
                ->paginate($this->perPage($request)),
        );
    }

    public function analytics(SalesAnalyticsService $analytics)
    {
        $this->authorize('viewAny', ClientOrderForm::class);

        return response()->json($analytics->overview());
    }
}
