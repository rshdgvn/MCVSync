<?php

namespace App\Services;

use App\Models\Branch;
use App\Models\Client;
use App\Models\Employee;
use App\Models\IncomingClientMessage;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class IncomingMessageService
{
    private const DISK = 'local';

    private const DIRECTORY = 'incoming-messages';

    public function listQuery(?string $status, ?int $clientId): Builder
    {
        return IncomingClientMessage::query()
            ->with(['client.user', 'loggedBy.user', 'convertedCof'])
            ->when($status, fn (Builder $query, string $value) => $query->where('status', $value))
            ->when($clientId, fn (Builder $query, int $value) => $query->where('client_id', $value))
            ->latest('received_at')
            ->orderByDesc('id');
    }

    public function log(Client $client, string $channel, UploadedFile $attachment, ?string $receivedAt, ?string $notes, Employee $loggedBy): IncomingClientMessage
    {
        $path = $attachment->store(self::DIRECTORY, self::DISK);

        return IncomingClientMessage::create([
            'client_id' => $client->id,
            'branch_id' => $loggedBy->branch_id ?? $client->branch_id ?? Branch::where('is_main', true)->value('id'),
            'channel' => $channel,
            'attachment_path' => $path,
            'attachment_name' => $attachment->getClientOriginalName(),
            'notes' => $notes,
            'received_at' => $receivedAt ?? now(),
            'logged_by' => $loggedBy->id,
        ]);
    }

    public function download(IncomingClientMessage $message): StreamedResponse
    {
        return Storage::disk(self::DISK)->download($message->attachment_path, $message->attachment_name);
    }
}
