<?php

use App\Exceptions\InsufficientStockException;
use App\Http\Middleware\EnsureActiveAccount;
use App\Http\Middleware\EnsureHasRole;
use App\Http\Middleware\ScopeToBranch;
use Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
        $middleware->trustProxies(at: '*');
        $middleware->appendToPriorityList(AuthenticatesRequests::class, ScopeToBranch::class);

        $middleware->alias([
            'ensure-active-account' => EnsureActiveAccount::class,
            'scope-to-branch' => ScopeToBranch::class,
            'has-role' => EnsureHasRole::class,
        ]);
    })
    ->withBroadcasting(
        __DIR__.'/../routes/channels.php',
        // Registered under /api so it inherits the same Sanctum stateful
        // cookie handling (statefulApi()) as every other endpoint here —
        // channel subscribers are always the staff-guard session, never
        // the framework's unused default `web` guard.
        ['prefix' => 'api', 'middleware' => ['api', 'auth:staff', 'ensure-active-account']],
    )
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );

        $exceptions->render(fn (InsufficientStockException $exception) => response()->json([
            'message' => $exception->getMessage(),
            'reason' => 'insufficient_stock',
            'item_id' => $exception->itemId,
            'branch_id' => $exception->branchId,
            'requested' => $exception->requested,
            'available' => $exception->available,
        ], 422));
    })->create();
