<?php

namespace App\Services;

use App\Models\ClientItemDiscount;
use App\Models\Employee;
use App\Services\Concerns\ResolvesCurrentClientItemRow;
use Illuminate\Database\Eloquent\Builder;

class DiscountService
{
    use ResolvesCurrentClientItemRow;

    public function currentDiscount(int $clientId, int $itemId): ?ClientItemDiscount
    {
        return $this->latestRow($clientId, $itemId);
    }

    /**
     * @param  array<int, int>  $itemIds
     * @return array<int, float>
     */
    public function currentDiscountsFor(int $clientId, array $itemIds): array
    {
        if ($itemIds === []) {
            return [];
        }

        return $this->currentRowsQuery($clientId, null, $itemIds)
            ->pluck('discount_percent', 'item_id')
            ->map(fn ($percent) => (float) $percent)
            ->all();
    }

    public function history(int $clientId, int $itemId): Builder
    {
        return $this->rowHistory($clientId, $itemId);
    }

    public function currentDiscountsQuery(?int $clientId, ?int $itemId): Builder
    {
        return $this->currentRowsQuery($clientId, $itemId);
    }

    public function setDiscount(int $clientId, int $itemId, float $discountPercent, Employee $setBy): ClientItemDiscount
    {
        return ClientItemDiscount::create([
            'client_id' => $clientId,
            'item_id' => $itemId,
            'discount_percent' => $discountPercent,
            'set_by' => $setBy->id,
        ]);
    }

    protected function clientItemModel(): string
    {
        return ClientItemDiscount::class;
    }
}
