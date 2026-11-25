<?php

namespace App\Services;

use App\Models\Client;
use App\Models\ClientOrderForm;
use App\Models\ClientSubmission;
use Illuminate\Support\Facades\DB;

class ClientSubmissionService
{
    public function __construct(private readonly ClientOrderFormService $orders) {}

    /**
     * @param  array<int, array{item_id: int, quantity: int}>  $items
     */
    public function submit(Client $client, array $items, ?string $notes): ClientOrderForm
    {
        return DB::transaction(function () use ($client, $items, $notes) {
            $submission = ClientSubmission::create([
                'client_id' => $client->id,
                'notes' => $notes,
                'submitted_at' => now(),
            ]);

            foreach ($items as $line) {
                $submission->items()->create(['item_id' => $line['item_id'], 'quantity' => $line['quantity']]);
            }

            return $this->orders->createFromSubmission($submission->load(['items', 'client']));
        });
    }
}
