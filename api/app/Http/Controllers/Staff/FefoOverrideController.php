<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Http\Resources\FefoOverrideCodeResource;
use App\Models\FefoOverrideCode;
use App\Services\FefoOverrideService;
use Illuminate\Http\Request;

class FefoOverrideController extends Controller
{
    public function store(Request $request, FefoOverrideService $service)
    {
        $this->authorize('create', FefoOverrideCode::class);

        $override = $service->generate($request->user('staff')->employee);

        return (new FefoOverrideCodeResource($override))
            ->response()
            ->setStatusCode(201);
    }
}
