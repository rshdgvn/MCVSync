<?php

use App\Models\Client;
use App\Models\ClientItemPrice;
use App\Models\ClientOrderForm;
use App\Models\Item;
use App\Models\StockReservation;
use App\Models\User;

const SALES_PERMISSIONS = [
    'cof.view',
    'cof.create',
    'cof.forward_to_purchasing',
    'cof.approve_dispatch',
    'cof.confirm_cancellation',
    'client.view',
    'client.manage',
    'discount.set',
];

function grantSalesPermissions(): void
{
    foreach (SALES_PERMISSIONS as $permission) {
        grantRolePermission($permission, ['sales', 'super_admin']);
    }
}

function makeSalesUser(string $branchCode = 'APALIT'): User
{
    grantSalesPermissions();

    return assignStaffRole(makeStaffUser([], $branchCode), 'sales');
}

function clientOf(User $clientUser): Client
{
    return Client::where('user_id', $clientUser->id)->firstOrFail();
}

function priceFor(User $clientUser, Item $item, float $srp, User $accountant): ClientItemPrice
{
    return ClientItemPrice::create([
        'client_id' => clientOf($clientUser)->id,
        'item_id' => $item->id,
        'srp' => $srp,
        'set_by' => $accountant->employee->id,
    ]);
}

function portalOrder($test, User $clientUser, array $quantitiesByItemId, ?string $notes = null): ClientOrderForm
{
    $items = collect($quantitiesByItemId)->map(fn (int $quantity, int $itemId) => ['item_id' => $itemId, 'quantity' => $quantity])->values()->all();

    $id = $test->actingAs($clientUser, 'client')
        ->postJson('/api/portal/orders', ['items' => $items, 'notes' => $notes])
        ->assertCreated()
        ->json('id');

    return ClientOrderForm::withoutGlobalScopes()->findOrFail($id);
}

function forwardedOrder($test, User $sales, User $clientUser, array $quantitiesByItemId, float $srp = 100): ClientOrderForm
{
    foreach (array_keys($quantitiesByItemId) as $itemId) {
        priceFor($clientUser, Item::findOrFail($itemId), $srp, $sales);
    }

    $cof = portalOrder($test, $clientUser, $quantitiesByItemId);
    $test->actingAs($sales, 'staff')->postJson("/api/staff/client-order-forms/{$cof->id}/forward")->assertOk();

    return $cof->fresh();
}

function orderReservations(ClientOrderForm $cof)
{
    return StockReservation::withoutGlobalScopes()
        ->where('reference_type', 'client_order_form')
        ->where('reference_id', $cof->id);
}
