<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\SupplierRequest;
use App\Http\Resources\SupplierResource;
use App\Models\Supplier;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', Supplier::class);

        $suppliers = Supplier::query()
            ->when($request->filled('search'), fn ($query) => $query->where('name', 'like', '%'.$request->string('search').'%'))
            ->orderBy('name')
            ->paginate($this->perPage($request));

        return SupplierResource::collection($suppliers);
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
}
