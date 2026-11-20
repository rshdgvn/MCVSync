<?php

namespace App\Services;

use App\Models\ClientOrderForm;
use App\Models\Delivery;
use App\Models\Employee;
use App\Services\Concerns\EnforcesActingBranch;
use App\Support\BusinessDate;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DeliveryService
{
    use EnforcesActingBranch;

    public function __construct(
        private readonly ClientOrderFormService $orders,
        private readonly AuditLogger $audit,
    ) {}

    public function confirm(ClientOrderForm $cof, array $data, Employee $actor, ?int $actingBranchId): Delivery
    {
        try {
            return DB::transaction(function () use ($cof, $data, $actor, $actingBranchId) {
                $locked = ClientOrderForm::query()->withoutGlobalScopes()->lockForUpdate()->findOrFail($cof->id);

                if (Delivery::query()->where('client_order_form_id', $locked->id)->exists()) {
                    $this->rejectAlreadyDelivered();
                }

                $this->ensureActingBranch($actingBranchId, $locked->branch_id, 'Only the branch delivering this order can confirm it.');
                $this->orders->markDelivered($locked);
                $this->assertDeliveryDate(CarbonImmutable::parse($data['delivery_date']), $locked);

                $delivery = Delivery::create([
                    'client_order_form_id' => $locked->id,
                    'delivery_date' => $data['delivery_date'],
                    'received_by' => $data['received_by'],
                    'notes' => $data['notes'] ?? null,
                    'confirmed_by' => $actor->id,
                ]);

                $this->audit->record('client_order_form.delivered', $actor->user, 'staff', [
                    'client_order_form_id' => $locked->id,
                    'cof_number' => $locked->cof_number,
                    'summary' => "Order {$locked->cof_number} confirmed delivered by {$actor->user->name}",
                ]);

                return $delivery;
            });
        } catch (UniqueConstraintViolationException) {
            $this->rejectAlreadyDelivered();
        }
    }

    private function assertDeliveryDate(CarbonImmutable $deliveryDate, ClientOrderForm $cof): void
    {
        $date = $deliveryDate->toDateString();

        if ($date > BusinessDate::todayString()) {
            throw ValidationException::withMessages(['delivery_date' => 'The delivery date cannot be in the future.']);
        }

        $readyOn = $cof->ready_for_delivery_at
            ?->copy()
            ->setTimezone(config('mcvsync.business_timezone'))
            ->toDateString();

        if ($readyOn !== null && $date < $readyOn) {
            throw ValidationException::withMessages([
                'delivery_date' => "The delivery date cannot be before the order was ready for delivery ({$readyOn}).",
            ]);
        }
    }

    private function rejectAlreadyDelivered(): never
    {
        abort(409, 'This order has already been confirmed delivered.');
    }
}
