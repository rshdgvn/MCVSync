<?php

namespace App\Services;

use App\Models\Batch;
use App\Models\PurchaseOrder;
use App\Models\Scopes\BranchScope;
use App\Models\StockTransaction;
use App\Models\TransferRequest;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\CarbonImmutable;
use DateTimeInterface;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class DocumentService
{
    private const PRINTABLE_PURCHASE_ORDER_STATUSES = ['open', 'ready_for_delivery', 'closed'];

    private const PRINTABLE_TRANSFER_STATUSES = ['shipped', 'closed'];

    public function purchaseOrder(PurchaseOrder $purchaseOrder): Response
    {
        return $this->stream($this->purchaseOrderView($purchaseOrder), $purchaseOrder->po_number);
    }

    public function transmittalReceipt(TransferRequest $transfer): Response
    {
        return $this->stream($this->transmittalReceiptView($transfer), $transfer->transfer_number);
    }

    public function purchaseOrderView(PurchaseOrder $purchaseOrder): View
    {
        $this->assertPrintable(
            $purchaseOrder->status,
            self::PRINTABLE_PURCHASE_ORDER_STATUSES,
            'Only an open, ready for delivery or closed purchase order can be printed. Finalize a draft first.',
        );

        $purchaseOrder->load(['supplier', 'branch', 'preparedBy.user', 'items.item.unit']);
        $lines = $purchaseOrder->items;

        return $this->view('documents.purchase-order', 'Purchase Order', $purchaseOrder->po_number, [
            'details' => [
                'Supplier' => [
                    'Name' => $purchaseOrder->supplier?->name,
                    'Contact' => $purchaseOrder->supplier?->contact_person,
                    'Phone' => $purchaseOrder->supplier?->phone,
                    'Address' => $purchaseOrder->supplier?->address,
                ],
                'Order' => [
                    'PO Date' => $this->date($purchaseOrder->order_date),
                    'Deliver To' => $purchaseOrder->branch->name,
                    'Address' => $purchaseOrder->branch->address,
                    'Deliver By' => $this->date($purchaseOrder->request_delivery_date),
                    'Terms' => $purchaseOrder->terms,
                ],
            ],
            'lines' => $lines,
            'subtotal' => $lines->sum(fn ($line) => $line->quantity_ordered * (float) $line->unit_cost),
            'discount' => $lines->sum(fn ($line) => (float) $line->discount),
            'total' => $lines->sum(fn ($line) => (float) $line->total),
            'remarks' => $purchaseOrder->remarks,
            'signatures' => [
                ['label' => 'Prepared by', 'name' => $purchaseOrder->preparedBy?->user->name],
                ['label' => 'Approved by'],
            ],
        ]);
    }

    public function transmittalReceiptView(TransferRequest $transfer): View
    {
        $this->assertPrintable(
            $transfer->status,
            self::PRINTABLE_TRANSFER_STATUSES,
            'A transmittal receipt is available once the transfer has shipped.',
        );

        $transfer->load(['requestingBranch', 'fulfillingBranch', 'requestedBy.user', 'decidedBy.user', 'items.item.unit']);

        return $this->view('documents.transmittal-receipt', 'Transmittal Receipt', $transfer->transfer_number, [
            'details' => [
                'Transfer' => [
                    'From' => $transfer->fulfillingBranch->name,
                    'To' => $transfer->requestingBranch->name,
                    'Requested By' => $transfer->requestedBy?->user->name,
                    'Approved By' => $transfer->decidedBy?->user->name,
                ],
                'Shipment' => [
                    'Requested' => $this->dateTime($transfer->created_at),
                    'Shipped' => $this->dateTime($transfer->shipped_at),
                    'Received' => $this->dateTime($transfer->received_at),
                ],
            ],
            'lines' => $transfer->items,
            'batchesByItem' => $this->pickedBatches($transfer),
            'received' => $transfer->status === 'closed',
            'remarks' => $transfer->remarks,
            'signatures' => [
                ['label' => 'Released by'],
                ['label' => 'Delivered by'],
                ['label' => 'Received by'],
            ],
        ]);
    }

    /**
     * @return Collection<int, array<int, array{number: string, expiry: ?string, quantity: int}>>
     */
    private function pickedBatches(TransferRequest $transfer): Collection
    {
        return StockTransaction::query()
            ->withoutGlobalScope(BranchScope::class)
            ->where('reference_type', $transfer->getMorphClass())
            ->where('reference_id', $transfer->getKey())
            ->where('type', $transfer->fulfillmentTransactionType())
            ->with(['batch' => fn ($query) => $query->withoutGlobalScope(BranchScope::class)])
            ->orderBy('id')
            ->get()
            ->groupBy('item_id')
            ->map(fn (Collection $picks) => $picks->groupBy('batch_id')->map(fn (Collection $batchPicks) => [
                'number' => $this->batchNumber($batchPicks->first()->batch),
                'expiry' => $this->date($batchPicks->first()->batch?->expiry_date),
                'quantity' => (int) abs($batchPicks->sum('quantity')),
            ])->values()->all());
    }

    private function batchNumber(?Batch $batch): string
    {
        return $batch?->batch_number ?? '—';
    }

    private function view(string $name, string $title, string $number, array $data): View
    {
        return view($name, [
            ...$data,
            'title' => $title,
            'number' => $number,
            'company' => config('mcvsync.company'),
            'generatedAt' => CarbonImmutable::now(config('mcvsync.business_timezone'))->format('M j, Y, g:i A'),
            'money' => fn (float|string $amount) => '₱'.number_format((float) $amount, 2),
        ]);
    }

    private function stream(View $view, string $number): Response
    {
        return Pdf::loadHTML($view->render())
            ->setPaper('a4')
            ->setOption('isFontSubsettingEnabled', true)
            ->stream("{$number}.pdf");
    }

    private function assertPrintable(string $status, array $printableStatuses, string $message): void
    {
        if (! in_array($status, $printableStatuses, true)) {
            throw ValidationException::withMessages(['status' => $message]);
        }
    }

    private function date(?DateTimeInterface $date): ?string
    {
        return $date?->format('M j, Y');
    }

    private function dateTime(?DateTimeInterface $dateTime): ?string
    {
        return $dateTime === null
            ? null
            : CarbonImmutable::instance($dateTime)->setTimezone(config('mcvsync.business_timezone'))->format('M j, Y, g:i A');
    }
}
