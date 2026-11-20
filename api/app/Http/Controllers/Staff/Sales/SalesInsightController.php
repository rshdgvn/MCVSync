<?php

namespace App\Http\Controllers\Staff\Sales;

use App\Http\Controllers\Controller;
use App\Http\Resources\SalesExpiryAlertResource;
use App\Models\ClientOrderForm;
use App\Services\AlertService;
use App\Services\SalesAnalyticsService;
use Illuminate\Http\Request;

class SalesInsightController extends Controller
{
    public function expiryAlerts(Request $request, AlertService $alerts)
    {
        $this->authorize('viewAny', ClientOrderForm::class);

        return SalesExpiryAlertResource::collection($alerts->expiringItemsByBranch($this->currentBranchId(), $this->perPage($request)));
    }

    public function analytics(SalesAnalyticsService $analytics)
    {
        $this->authorize('viewAny', ClientOrderForm::class);

        return response()->json($analytics->overview());
    }
}
