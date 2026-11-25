<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Resources\Portal\ItemResource;
use App\Services\ItemCatalogService;
use Illuminate\Http\Request;

class ItemController extends Controller
{
    public function index(Request $request, ItemCatalogService $catalog)
    {
        $items = $catalog->activeItemsQuery(
            $request->filled('search') ? (string) $request->string('search') : null,
            $request->filled('category_id') ? $request->integer('category_id') : null,
        )->paginate();

        return ItemResource::collection($items);
    }
}
