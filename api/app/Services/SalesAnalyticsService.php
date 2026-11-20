<?php

namespace App\Services;

use App\Support\BusinessDate;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

class SalesAnalyticsService
{
    private const TREND_MONTHS = 6;

    private const TOP_LIMIT = 5;

    private const QUIET_AFTER_DAYS = 30;

    private const BILLED_STATUSES = ['processing', 'ready_for_delivery', 'delivered', 'completed'];

    public function overview(): array
    {
        return [
            'monthly' => $this->monthlyTrend(),
            'top_clients' => $this->topClients(),
            'top_items' => $this->topItems(),
            'quiet_clients' => $this->quietClients(),
        ];
    }

    private function monthlyTrend(): array
    {
        $since = BusinessDate::today()->startOfMonth()->subMonths(self::TREND_MONTHS - 1);
        $month = $this->monthExpression('cof.created_at');

        $rows = $this->orders()
            ->where('cof.created_at', '>=', $since)
            ->leftJoin('client_order_form_items as line', 'line.client_order_form_id', '=', 'cof.id')
            ->groupByRaw($month)
            ->selectRaw("{$month} as month, COUNT(DISTINCT cof.id) as order_count, COALESCE(SUM(CASE WHEN cof.order_status IN (?, ?, ?, ?) THEN line.total ELSE 0 END), 0) as order_value", self::BILLED_STATUSES)
            ->get()
            ->keyBy('month');

        return collect(range(0, self::TREND_MONTHS - 1))
            ->map(fn (int $offset) => $since->addMonths($offset)->format('Y-m'))
            ->map(fn (string $key) => [
                'month' => $key,
                'order_count' => (int) ($rows[$key]->order_count ?? 0),
                'order_value' => round((float) ($rows[$key]->order_value ?? 0), 2),
            ])
            ->all();
    }

    private function topClients(): array
    {
        return $this->orders()
            ->join('client_order_form_items as line', 'line.client_order_form_id', '=', 'cof.id')
            ->join('clients', 'clients.id', '=', 'cof.client_id')
            ->join('users', 'users.id', '=', 'clients.user_id')
            ->whereIn('cof.order_status', self::BILLED_STATUSES)
            ->groupBy('clients.id', 'users.name')
            ->selectRaw('clients.id as client_id, users.name, COUNT(DISTINCT cof.id) as order_count, COALESCE(SUM(line.total), 0) as order_value')
            ->orderByDesc('order_value')
            ->limit(self::TOP_LIMIT)
            ->get()
            ->map(fn ($row) => [
                'client_id' => (int) $row->client_id,
                'name' => $row->name,
                'order_count' => (int) $row->order_count,
                'order_value' => round((float) $row->order_value, 2),
            ])
            ->all();
    }

    private function topItems(): array
    {
        return $this->orders()
            ->join('client_order_form_items as line', 'line.client_order_form_id', '=', 'cof.id')
            ->join('items', 'items.id', '=', 'line.item_id')
            ->whereIn('cof.order_status', self::BILLED_STATUSES)
            ->groupBy('items.id', 'items.name', 'items.sku')
            ->selectRaw('items.id as item_id, items.name, items.sku, SUM(line.quantity) as total_quantity, COUNT(DISTINCT cof.id) as order_count')
            ->orderByDesc('total_quantity')
            ->limit(self::TOP_LIMIT)
            ->get()
            ->map(fn ($row) => [
                'item_id' => (int) $row->item_id,
                'name' => $row->name,
                'sku' => $row->sku,
                'total_quantity' => (int) $row->total_quantity,
                'order_count' => (int) $row->order_count,
            ])
            ->all();
    }

    private function quietClients(): array
    {
        $cutoff = BusinessDate::today()->subDays(self::QUIET_AFTER_DAYS);

        return $this->orders()
            ->join('clients', 'clients.id', '=', 'cof.client_id')
            ->join('users', 'users.id', '=', 'clients.user_id')
            ->groupBy('clients.id', 'users.name')
            ->havingRaw('MAX(cof.created_at) < ?', [$cutoff])
            ->selectRaw('clients.id as client_id, users.name, MAX(cof.created_at) as last_order_at')
            ->orderByRaw('MAX(cof.created_at)')
            ->get()
            ->map(fn ($row) => [
                'client_id' => (int) $row->client_id,
                'name' => $row->name,
                'last_order_at' => $row->last_order_at,
                'days_since_last_order' => -BusinessDate::daysFromToday(substr((string) $row->last_order_at, 0, 10)),
            ])
            ->all();
    }

    private function orders(): Builder
    {
        return DB::table('client_order_forms as cof')
            ->where('cof.order_status', '!=', 'cancelled')
            ->when(app()->bound('currentBranchId'), fn ($query) => $query->where('cof.branch_id', app('currentBranchId')));
    }

    private function monthExpression(string $column): string
    {
        return match (DB::connection()->getDriverName()) {
            'pgsql' => "to_char({$column}, 'YYYY-MM')",
            default => "strftime('%Y-%m', {$column})",
        };
    }
}
