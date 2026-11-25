<?php

use App\Models\Batch;
use App\Models\Item;
use App\Models\PurchaseOrder;
use App\Models\StockTransaction;
use App\Models\Supplier;
use App\Models\TransferRequest;
use App\Models\User;
use App\Services\DocumentService;

function pdfText(string $text): string
{
    return mb_convert_encoding($text, 'UTF-16BE', 'UTF-8');
}

function printablePurchaseOrder(User $user, string $status = 'open'): PurchaseOrder
{
    $po = PurchaseOrder::factory()->create([
        'po_number' => 'PO-0042',
        'branch_id' => $user->employee->branch_id,
        'supplier_id' => Supplier::factory()->create(['name' => 'Luzon Surgical Corp'])->id,
        'status' => $status,
        'remarks' => 'Deliver to the back gate.',
    ]);
    $po->items()->create([
        'item_id' => Item::factory()->create(['name' => 'Surgical Gloves Medium'])->id,
        'quantity_ordered' => 10, 'quantity_received' => 0, 'unit_cost' => 450, 'discount' => 100, 'total' => 4400,
    ]);

    return $po;
}

function shippedTransfer(User $main, User $cebu, string $status = 'shipped'): TransferRequest
{
    $item = Item::factory()->create(['name' => 'Syringe 5ml']);
    $transfer = makeTransfer($cebu, $main, [$item->id => 5]);
    $transfer->update(['transfer_number' => 'TR-0042', 'status' => $status, 'shipped_at' => now()]);
    $transfer->items()->update(['quantity_picked' => 5]);

    foreach ([['SYR-EARLY', '2027-01-31', 3], ['SYR-LATE', '2027-09-30', 2]] as [$number, $expiry, $quantity]) {
        $batch = Batch::factory()->create(['item_id' => $item->id, 'branch_id' => $main->employee->branch_id, 'batch_number' => $number, 'expiry_date' => $expiry]);
        StockTransaction::create([
            'item_id' => $item->id, 'batch_id' => $batch->id, 'branch_id' => $main->employee->branch_id, 'type' => 'transfer_out',
            'quantity' => -$quantity, 'reference_type' => $transfer->getMorphClass(), 'reference_id' => $transfer->id,
            'performed_by' => $main->employee->id,
        ]);
    }

    return $transfer;
}

test('a finalized purchase order streams inline as a pdf named after its number', function (string $status) {
    $user = makePurchasingUser('APALIT');
    $po = printablePurchaseOrder($user, $status);

    $response = $this->actingAs($user, 'staff')->get("/api/staff/purchase-orders/{$po->id}/document.pdf");

    $response->assertOk();
    expect($response->headers->get('Content-Type'))->toBe('application/pdf');
    expect($response->headers->get('Content-Disposition'))->toBe('inline; filename=PO-0042.pdf');
    expect($response->getContent())->toStartWith('%PDF-');
    expect(str_contains($response->getContent(), pdfText('Purchase Order PO-0042')))->toBeTrue();
})->with(['open', 'ready_for_delivery', 'closed']);

test('a draft or cancelled purchase order has no document', function (string $status) {
    $user = makePurchasingUser('APALIT');
    $po = printablePurchaseOrder($user, $status);

    $this->actingAs($user, 'staff')->getJson("/api/staff/purchase-orders/{$po->id}/document.pdf")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['status']);
})->with(['draft', 'cancelled']);

test('the purchase order document shows the supplier, lines, totals and who prepared it', function () {
    $user = makePurchasingUser('APALIT');
    $po = printablePurchaseOrder($user);

    $html = app(DocumentService::class)->purchaseOrderView($po)->render();

    expect($html)->toContain('PO-0042')
        ->toContain('Luzon Surgical Corp')
        ->toContain('Surgical Gloves Medium')
        ->toContain('₱4,500.00')
        ->toContain('₱100.00')
        ->toContain('₱4,400.00')
        ->toContain('Deliver to the back gate.')
        ->toContain($po->preparedBy->user->name)
        ->toContain('Prepared by')
        ->toContain('Approved by');
});

test('another branch cannot download a purchase order document', function () {
    $po = printablePurchaseOrder(makePurchasingUser('APALIT'));

    $this->actingAs(makePurchasingUser('CEBU'), 'staff')->getJson("/api/staff/purchase-orders/{$po->id}/document.pdf")->assertNotFound();
});

test('roles without inventory access cannot download a purchase order document', function () {
    $po = printablePurchaseOrder(makePurchasingUser('APALIT'));
    $sales = assignStaffRole(makeStaffUser([], 'APALIT'), 'sales');

    $this->actingAs($sales, 'staff')->getJson("/api/staff/purchase-orders/{$po->id}/document.pdf")->assertForbidden();
});

test('both branches on a shipped or closed transfer can download its transmittal receipt', function (string $status) {
    $main = makePurchasingUser('APALIT');
    $cebu = makePurchasingUser('CEBU');
    $transfer = shippedTransfer($main, $cebu, $status);

    foreach ([$main, $cebu] as $user) {
        $response = $this->actingAs($user, 'staff')->get("/api/staff/transfers/{$transfer->id}/transmittal-receipt.pdf");

        $response->assertOk();
        expect($response->headers->get('Content-Type'))->toBe('application/pdf');
        expect($response->headers->get('Content-Disposition'))->toBe('inline; filename=TR-0042.pdf');
        expect(str_contains($response->getContent(), pdfText('Transmittal Receipt TR-0042')))->toBeTrue();
    }
})->with(['shipped', 'closed']);

test('a transfer that has not shipped has no transmittal receipt', function (string $status) {
    $main = makePurchasingUser('APALIT');
    $transfer = shippedTransfer($main, makePurchasingUser('CEBU'), $status);

    $this->actingAs($main, 'staff')->getJson("/api/staff/transfers/{$transfer->id}/transmittal-receipt.pdf")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['status' => 'A transmittal receipt is available once the transfer has shipped.']);
})->with(['awaiting_approval', 'pending', 'cancelled', 'declined']);

test('the transmittal receipt lists picked batches with expiry and the three signature lines', function () {
    $main = makePurchasingUser('APALIT');
    $transfer = shippedTransfer($main, makePurchasingUser('CEBU'));

    $html = app(DocumentService::class)->transmittalReceiptView($transfer)->render();

    expect($html)->toContain('TR-0042')
        ->toContain('Syringe 5ml')
        ->toContain('SYR-EARLY</span> × 3')
        ->toContain('Exp. Jan 31, 2027')
        ->toContain('SYR-LATE</span> × 2')
        ->toContain('Exp. Sep 30, 2027')
        ->toContain('Released by')
        ->toContain('Delivered by')
        ->toContain('Received by');
});

test('a branch outside the transfer cannot download its transmittal receipt', function () {
    $transfer = shippedTransfer(makePurchasingUser('APALIT'), makePurchasingUser('CEBU'));

    $this->actingAs(makePurchasingUser('DAVAO'), 'staff')->getJson("/api/staff/transfers/{$transfer->id}/transmittal-receipt.pdf")->assertNotFound();
});

test('roles without inventory access cannot download a transmittal receipt', function () {
    $transfer = shippedTransfer(makePurchasingUser('APALIT'), makePurchasingUser('CEBU'));
    $sales = assignStaffRole(makeStaffUser([], 'APALIT'), 'sales');

    $this->actingAs($sales, 'staff')->getJson("/api/staff/transfers/{$transfer->id}/transmittal-receipt.pdf")->assertForbidden();
});

test('the shared layout shows company details from config', function () {
    config(['mcvsync.company' => ['name' => 'MCV Medical Trading', 'address' => 'Apalit, Pampanga', 'phone' => '045 123 4567', 'tin' => '123-456-789-000']]);
    $po = printablePurchaseOrder(makePurchasingUser('APALIT'));

    $html = app(DocumentService::class)->purchaseOrderView($po)->render();

    expect($html)->toContain('MCV Medical Trading')
        ->toContain('Apalit, Pampanga')
        ->toContain('Tel. 045 123 4567')
        ->toContain('TIN 123-456-789-000')
        ->toContain('Generated by MCVSync on');
});
