<?php

namespace App\Services;

use App\Models\ClientOrderForm;
use App\Models\Delivery;
use App\Support\BusinessDate;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Facades\DB;

class LogisticsQueueService
{
    public const HISTORY_STATUSES = ['delivered', 'completed'];

    public function incomingOrders(): Builder
    {
        return ClientOrderForm::query()
            ->where('order_status', 'processing')
            ->with('client.user')
            ->orderBy('request_delivery_date')
            ->orderBy('id');
    }

    public function readyToDeliver(): Builder
    {
        return ClientOrderForm::query()
            ->where('order_status', 'ready_for_delivery')
            ->with('client.user')
            ->withSum('items', 'total')
            ->orderBy('ready_for_delivery_at')
            ->orderBy('id');
    }

    public function deliveryHistory(?string $from, ?string $to): Builder
    {
        return Delivery::query()
            ->whereHas('clientOrderForm', fn (Builder $query) => $query->whereIn('order_status', self::HISTORY_STATUSES))
            ->with(['clientOrderForm.client.user', 'confirmedBy.user'])
            ->when($from, fn (Builder $query, string $date) => $query->whereDate('delivery_date', '>=', $date))
            ->when($to, fn (Builder $query, string $date) => $query->whereDate('delivery_date', '<=', $date))
            ->orderByDesc('delivery_date')
            ->orderByDesc('id');
    }

    public function daysInQueue(ClientOrderForm $cof): int
    {
        if ($cof->ready_for_delivery_at === null) {
            return 0;
        }

        $readyOn = $cof->ready_for_delivery_at->copy()->setTimezone(config('mcvsync.business_timezone'))->toDateString();

        return max(0, -BusinessDate::daysFromToday($readyOn));
    }

    public function isAging(int $daysInQueue): bool
    {
        return $daysInQueue >= config('mcvsync.delivery_aging_days', 2);
    }

    public function summary(): array
    {
        $weekStart = BusinessDate::today()->startOfWeek()->setTimezone('UTC');

        $average = $this->deliveries()
            ->where('deliveries.created_at', '>=', $weekStart)
            ->whereNotNull('cof.ready_for_delivery_at')
            ->selectRaw('AVG('.$this->secondsBetween('cof.ready_for_delivery_at', 'deliveries.created_at').') as average_seconds')
            ->value('average_seconds');

        return [
            'ready_to_deliver' => $this->readyToDeliver()->count(),
            'delivered_today' => $this->deliveries()->whereDate('deliveries.delivery_date', BusinessDate::todayString())->count(),
            'average_delivery_hours_this_week' => $average === null ? null : round((float) $average / 3600, 1),
        ];
    }

    private function deliveries(): QueryBuilder
    {
        return DB::table('deliveries')
            ->join('client_order_forms as cof', 'cof.id', '=', 'deliveries.client_order_form_id')
            ->when(app()->bound('currentBranchId'), fn ($query) => $query->where('cof.branch_id', app('currentBranchId')));
    }

    private function secondsBetween(string $start, string $end): string
    {
        return match (DB::connection()->getDriverName()) {
            'pgsql' => "EXTRACT(EPOCH FROM ({$end} - {$start}))",
            default => "(julianday({$end}) - julianday({$start})) * 86400",
        };
    }
}
