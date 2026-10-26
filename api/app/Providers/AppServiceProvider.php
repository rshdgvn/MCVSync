<?php

namespace App\Providers;

use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\TransferRequest;
use App\Models\TransferRequestItem;
use Illuminate\Auth\EloquentUserProvider;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // The frontend's api client (app/src/api/*.ts) expects flat
        // response bodies (Employee, Branch[], etc.) with no wrapping
        // envelope — matching the plain response()->json([...]) shape the
        // existing auth endpoints already return.
        JsonResource::withoutWrapping();

        Relation::morphMap([
            'purchase_order' => PurchaseOrder::class,
            'purchase_order_item' => PurchaseOrderItem::class,
            'transfer_request' => TransferRequest::class,
            'transfer_request_item' => TransferRequestItem::class,
        ]);

        Auth::provider('scoped-eloquent', function ($app, array $config) {
            return (new EloquentUserProvider($app['hash'], $config['model']))
                ->withQuery(fn ($query) => $query->where('type', $config['type']));
        });

        RateLimiter::for('login-staff', function ($request) {
            return Limit::perMinute(10)->by($request->ip());
        });

        RateLimiter::for('login-client', function ($request) {
            return Limit::perMinute(5)->by($request->ip());
        });
    }
}
