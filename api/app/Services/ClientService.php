<?php

namespace App\Services;

use App\Models\Client;
use App\Models\ClientOrderForm;
use App\Models\Employee;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class ClientService
{
    private const RELATIONS = ['user', 'zone', 'branch'];

    private const TOP_ITEMS_LIMIT = 5;

    public function __construct(private readonly AccountProvisioningService $provisioning) {}

    public function visibleQuery(): Builder
    {
        return Client::query()
            ->with(self::RELATIONS)
            ->when(app()->bound('currentBranchId'), fn (Builder $query) => $query->where('branch_id', app('currentBranchId')));
    }

    /**
     * @param  array{search?: string, zone_id?: int, client_type?: string}  $filters
     */
    public function listQuery(array $filters): Builder
    {
        return $this->visibleQuery()
            ->when($filters['search'] ?? null, function (Builder $query, string $search) {
                $pattern = '%'.$search.'%';
                $query->whereHas('user', fn (Builder $user) => $user->whereLike('name', $pattern)->orWhereLike('email', $pattern));
            })
            ->when($filters['zone_id'] ?? null, fn (Builder $query, int $zoneId) => $query->where('zone_id', $zoneId))
            ->when($filters['client_type'] ?? null, fn (Builder $query, string $type) => $query->where('client_type', $type))
            ->orderBy('id');
    }

    public function create(array $data, Employee $createdBy): Client
    {
        $client = $this->provisioning->createClient(
            ['name' => $data['name'], 'email' => $data['email'], 'password' => $data['password']],
            [
                'address' => $data['address'],
                'contact' => $data['contact'],
                'zone_id' => $data['zone_id'],
                'client_type' => $data['client_type'],
                'branch_id' => $data['branch_id'] ?? $createdBy->branch_id,
            ],
        );

        return $client->load(self::RELATIONS);
    }

    public function update(Client $client, array $data): Client
    {
        return DB::transaction(function () use ($client, $data) {
            if (array_key_exists('name', $data)) {
                $client->user->update(['name' => $data['name']]);
            }

            $client->update(collect($data)->only(['address', 'contact', 'zone_id', 'client_type', 'branch_id'])->all());

            return $client->load(self::RELATIONS);
        });
    }

    /**
     * @return array{top_items: array<int, array{item_id: int, name: string, sku: string, order_count: int, total_quantity: int}>, order_count: int, average_order_interval_days: ?float, days_since_last_order: ?int, last_order_at: ?string, overdue_ratio: ?float}
     */
    public function insights(Client $client): array
    {
        $orders = ClientOrderForm::query()
            ->where('client_id', $client->id)
            ->where('order_status', '!=', 'cancelled')
            ->orderBy('created_at')
            ->pluck('created_at')
            ->map(fn ($createdAt) => CarbonImmutable::parse($createdAt));

        $intervals = $orders->sliding(2)->map(fn ($pair) => $pair->first()->diffInDays($pair->last()));
        $average = $intervals->isEmpty() ? null : round((float) $intervals->avg(), 1);
        $daysSinceLast = $orders->isEmpty() ? null : (int) $orders->last()->diffInDays(CarbonImmutable::now());

        return [
            'top_items' => $this->topItems($client),
            'order_count' => $orders->count(),
            'average_order_interval_days' => $average,
            'days_since_last_order' => $daysSinceLast,
            'last_order_at' => $orders->last()?->toIso8601String(),
            'overdue_ratio' => $average && $daysSinceLast !== null ? round($daysSinceLast / $average, 2) : null,
        ];
    }

    private function topItems(Client $client): array
    {
        return DB::table('client_order_form_items as line')
            ->join('client_order_forms as cof', 'cof.id', '=', 'line.client_order_form_id')
            ->join('items', 'items.id', '=', 'line.item_id')
            ->where('cof.client_id', $client->id)
            ->where('cof.order_status', '!=', 'cancelled')
            ->groupBy('items.id', 'items.name', 'items.sku')
            ->selectRaw('items.id as item_id, items.name, items.sku, COUNT(DISTINCT cof.id) as order_count, SUM(line.quantity) as total_quantity')
            ->orderByDesc('order_count')
            ->orderByDesc('total_quantity')
            ->limit(self::TOP_ITEMS_LIMIT)
            ->get()
            ->map(fn ($row) => [
                'item_id' => (int) $row->item_id,
                'name' => $row->name,
                'sku' => $row->sku,
                'order_count' => (int) $row->order_count,
                'total_quantity' => (int) $row->total_quantity,
            ])
            ->all();
    }
}
