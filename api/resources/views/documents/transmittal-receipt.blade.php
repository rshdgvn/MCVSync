@extends('documents.layout')

@section('lines')
    <table class="lines">
        <thead>
            <tr>
                <th class="micro">#</th>
                <th class="micro">Item</th>
                <th class="micro">Unit</th>
                <th class="micro right">Requested</th>
                <th class="micro right">Released</th>
                <th class="micro">Batches</th>
                <th class="micro right">Received</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($lines as $index => $line)
                <tr>
                    <td>{{ $index + 1 }}</td>
                    <td>{{ $line->item->name }}<div class="sub mono">{{ $line->item->sku }}</div></td>
                    <td>{{ $line->item->unit?->code }}</td>
                    <td class="right mono">{{ number_format($line->quantity_requested) }}</td>
                    <td class="right mono">{{ number_format($line->quantity_picked) }}</td>
                    <td>
                        @forelse ($batchesByItem[$line->item_id] ?? [] as $batch)
                            <div><span class="mono">{{ $batch['number'] }}</span> × {{ number_format($batch['quantity']) }}<span class="muted"> · Exp. {{ $batch['expiry'] ?? 'none' }}</span></div>
                        @empty
                            <span class="muted">—</span>
                        @endforelse
                    </td>
                    <td class="right mono">{{ $received ? number_format($line->quantity_received) : '' }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
@endsection
