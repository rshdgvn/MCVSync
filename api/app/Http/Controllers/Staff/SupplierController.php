<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\SupplierRequest;
use App\Http\Resources\SupplierResource;
use App\Models\Supplier;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', Supplier::class);

        $suppliers = $this->searchedSuppliers($request)
            ->when($request->has('is_active'), fn (Builder $query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy('name')
            ->paginate($this->perPage($request));

        return SupplierResource::collection($suppliers)
            ->additional(['counts' => $this->statusCounts($request)]);
    }

    public function show(Supplier $supplier)
    {
        $this->authorize('view', $supplier);

        return new SupplierResource($supplier);
    }

    public function store(SupplierRequest $request)
    {
        $this->authorize('create', Supplier::class);

        $supplier = Supplier::create($request->validated());

        return (new SupplierResource($supplier))->response()->setStatusCode(201);
    }

    public function update(SupplierRequest $request, Supplier $supplier)
    {
        $this->authorize('update', $supplier);

        $supplier->update($request->validated());

        return new SupplierResource($supplier);
    }

    public function deactivate(Supplier $supplier)
    {
        $this->authorize('update', $supplier);

        $supplier->update(['is_active' => false]);

        return new SupplierResource($supplier);
    }

    public function activate(Supplier $supplier)
    {
        $this->authorize('update', $supplier);

        $supplier->update(['is_active' => true]);

        return new SupplierResource($supplier);
    }

    private function searchedSuppliers(Request $request): Builder
    {
        return Supplier::query()
            ->when($request->filled('search'), fn (Builder $query) => $query->whereLike('name', '%'.$request->string('search').'%'));
    }

    private function statusCounts(Request $request): array
    {
        $totals = $this->searchedSuppliers($request)
            ->toBase()
            ->selectRaw('is_active, COUNT(*) as total')
            ->groupBy('is_active')
            ->pluck('total', 'is_active');

        $active = (int) ($totals[1] ?? 0);
        $inactive = (int) ($totals[0] ?? 0);

        return ['all' => $active + $inactive, 'active' => $active, 'inactive' => $inactive];
    }
}
