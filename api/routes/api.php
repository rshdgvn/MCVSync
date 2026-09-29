<?php

use App\Http\Controllers\Portal\AuthController as PortalAuthController;
use App\Http\Controllers\Portal\CategoryController as PortalCategoryController;
use App\Http\Controllers\Portal\ItemController as PortalItemController;
use App\Http\Controllers\Portal\PasswordResetController as PortalPasswordResetController;
use App\Http\Controllers\Staff\AuthController as StaffAuthController;
use App\Http\Controllers\Staff\BranchController;
use App\Http\Controllers\Staff\DiscrepancyController;
use App\Http\Controllers\Staff\EmployeeController;
use App\Http\Controllers\Staff\Inventory\AlertController;
use App\Http\Controllers\Staff\Inventory\BatchController;
use App\Http\Controllers\Staff\Inventory\CategoryController;
use App\Http\Controllers\Staff\Inventory\ItemController;
use App\Http\Controllers\Staff\Inventory\StockController;
use App\Http\Controllers\Staff\Inventory\UnitController;
use App\Http\Controllers\Staff\PasswordResetController as StaffPasswordResetController;
use App\Http\Controllers\Staff\PaymentController;
use App\Http\Controllers\Staff\PermissionController;
use App\Http\Controllers\Staff\PricingController;
use App\Http\Controllers\Staff\PurchaseOrderController;
use App\Http\Controllers\Staff\PurchaseOrderItemController;
use App\Http\Controllers\Staff\ReceivingController;
use App\Http\Controllers\Staff\RoleController;
use App\Http\Controllers\Staff\SupplierController;
use Illuminate\Support\Facades\Route;

Route::prefix('staff/auth')->group(function () {
    Route::post('/login', [StaffAuthController::class, 'login'])->middleware('throttle:login-staff');
    Route::post('/password/forgot', [StaffPasswordResetController::class, 'forgot']);
    Route::post('/password/reset', [StaffPasswordResetController::class, 'reset']);

    Route::middleware(['auth:staff', 'ensure-active-account'])->group(function () {
        Route::post('/logout', [StaffAuthController::class, 'logout']);
        Route::get('/me', [StaffAuthController::class, 'me']);
    });
});

Route::prefix('staff')->middleware(['auth:staff', 'ensure-active-account'])->group(function () {
    Route::get('/branches', [BranchController::class, 'index']);

    Route::middleware('has-role:admin,super_admin')->group(function () {
        Route::get('/employees', [EmployeeController::class, 'index']);
        Route::post('/employees', [EmployeeController::class, 'store']);
        Route::patch('/employees/{employee}', [EmployeeController::class, 'update']);
        Route::post('/employees/{employee}/deactivate', [EmployeeController::class, 'deactivate']);
        Route::post('/employees/{employee}/activate', [EmployeeController::class, 'activate']);
        Route::get('/roles', [RoleController::class, 'index']);
        Route::get('/permissions', [PermissionController::class, 'index']);
        Route::put('/roles/{role:name}/permissions', [RoleController::class, 'updatePermissions']);
    });

    Route::middleware('has-role:super_admin')->group(function () {
        Route::put('/employees/{employee}/role', [EmployeeController::class, 'assignRole']);
    });
});

Route::prefix('staff/inventory')
    ->middleware(['auth:staff', 'ensure-active-account', 'scope-to-branch'])
    ->group(function () {
        Route::get('/categories', [CategoryController::class, 'index']);
        Route::post('/categories', [CategoryController::class, 'store']);
        Route::patch('/categories/{category}', [CategoryController::class, 'update']);
        Route::delete('/categories/{category}', [CategoryController::class, 'destroy']);

        Route::get('/units', [UnitController::class, 'index']);
        Route::post('/units', [UnitController::class, 'store']);
        Route::patch('/units/{unit}', [UnitController::class, 'update']);
        Route::delete('/units/{unit}', [UnitController::class, 'destroy']);

        Route::get('/items', [ItemController::class, 'index']);
        Route::post('/items', [ItemController::class, 'store']);
        Route::get('/items/{item}', [ItemController::class, 'show']);
        Route::patch('/items/{item}', [ItemController::class, 'update']);
        Route::get('/items/{item}/batches', [BatchController::class, 'index']);
        Route::get('/items/{item}/stock', [StockController::class, 'show']);
        Route::get('/items/{item}/transactions', [StockController::class, 'transactions']);

        Route::get('/alerts/expiring', [AlertController::class, 'expiring']);
        Route::get('/alerts/low-stock', [AlertController::class, 'lowStock']);
    });

Route::prefix('staff/suppliers')
    ->middleware(['auth:staff', 'ensure-active-account'])
    ->group(function () {
        Route::get('/', [SupplierController::class, 'index']);
        Route::post('/', [SupplierController::class, 'store']);
        Route::patch('/{supplier}', [SupplierController::class, 'update']);
        Route::post('/{supplier}/deactivate', [SupplierController::class, 'deactivate']);
        Route::post('/{supplier}/activate', [SupplierController::class, 'activate']);
    });

Route::prefix('staff/purchase-orders')
    ->middleware(['auth:staff', 'ensure-active-account', 'scope-to-branch'])
    ->group(function () {
        Route::get('/', [PurchaseOrderController::class, 'index']);
        Route::post('/', [PurchaseOrderController::class, 'store']);
        Route::get('/{purchaseOrder}', [PurchaseOrderController::class, 'show']);
        Route::patch('/{purchaseOrder}', [PurchaseOrderController::class, 'update']);
        Route::post('/{purchaseOrder}/items', [PurchaseOrderItemController::class, 'store']);
        Route::patch('/{purchaseOrder}/items/{item}', [PurchaseOrderItemController::class, 'update']);
        Route::delete('/{purchaseOrder}/items/{item}', [PurchaseOrderItemController::class, 'destroy']);
        Route::post('/{purchaseOrder}/mark-ready', [PurchaseOrderController::class, 'markReady']);
        Route::post('/{purchaseOrder}/cancel', [PurchaseOrderController::class, 'cancel']);

        Route::get('/{purchaseOrder}/receive', [ReceivingController::class, 'show']);
        Route::post('/{purchaseOrder}/receive/match', [ReceivingController::class, 'match']);
        Route::post('/{purchaseOrder}/receive/confirm', [ReceivingController::class, 'confirm']);
        Route::post('/{purchaseOrder}/receive/discrepancy', [ReceivingController::class, 'discrepancy']);
        Route::post('/{purchaseOrder}/receive/complete', [ReceivingController::class, 'complete']);

        Route::get('/{purchaseOrder}/discrepancies', [DiscrepancyController::class, 'index']);
    });

Route::prefix('staff/discrepancies')
    ->middleware(['auth:staff', 'ensure-active-account', 'scope-to-branch'])
    ->group(function () {
        Route::post('/{discrepancy}/resolve', [DiscrepancyController::class, 'resolve']);
    });

Route::prefix('staff/pricing')
    ->middleware(['auth:staff', 'ensure-active-account'])
    ->group(function () {
        Route::get('/items', [PricingController::class, 'items']);
        Route::get('/client-item-prices', [PricingController::class, 'index']);
        Route::get('/client-item-prices/history', [PricingController::class, 'history']);
        Route::get('/client-item-prices/zone-average', [PricingController::class, 'zoneAverage']);
        Route::post('/client-item-prices', [PricingController::class, 'store']);
    });

Route::prefix('staff/payments')
    ->middleware(['auth:staff', 'ensure-active-account'])
    ->group(function () {
        Route::get('/pending', [PaymentController::class, 'pending']);
        Route::post('/{payment}/approve', [PaymentController::class, 'approve']);
        Route::get('/history', [PaymentController::class, 'history']);
    });

Route::prefix('portal/auth')->group(function () {
    Route::post('/login', [PortalAuthController::class, 'login'])->middleware('throttle:login-client');
    Route::post('/password/forgot', [PortalPasswordResetController::class, 'forgot']);
    Route::post('/password/reset', [PortalPasswordResetController::class, 'reset']);

    Route::middleware(['auth:client', 'ensure-active-account'])->group(function () {
        Route::post('/logout', [PortalAuthController::class, 'logout']);
        Route::get('/me', [PortalAuthController::class, 'me']);
    });
});

Route::prefix('portal')
    ->middleware(['auth:client', 'ensure-active-account'])
    ->group(function () {
        Route::get('/items', [PortalItemController::class, 'index']);
        Route::get('/categories', [PortalCategoryController::class, 'index']);
    });
