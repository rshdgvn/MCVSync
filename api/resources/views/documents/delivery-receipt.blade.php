@extends('documents.layout')

@section('lines')
    <table class="lines">
        <thead>
            <tr>
                <th class="micro">#</th>
                <th class="micro">Item</th>
                <th class="micro">Unit</th>
                <th class="micro right">Ordered</th>
                <th class="micro right">Delivered</th>
                <th class="micro">Batches</th>
                <th class="micro right">Unit Cost</th>
                <th class="micro right">Discount</th>
                <th class="micro right">Total</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($lines as $index => $line)
                <tr>
                    <td>{{ $index + 1 }}</td>
                    <td>{{ $line->item->name }}<div class="sub mono">{{ $line->item->sku }}</div></td>
                    <td>{{ $line->item->unit?->code }}</td>
                    <td class="right mono">{{ number_format($line->quantity) }}</td>
                    <td class="right mono">{{ number_format($line->quantity_picked) }}</td>
                    <td>
                        @forelse ($batchesByItem[$line->item_id] ?? [] as $batch)
                            <div><span class="mono">{{ $batch['number'] }}</span> × {{ number_format($batch['quantity']) }}<span class="muted"> · Exp. {{ $batch['expiry'] ?? 'none' }}</span></div>
                        @empty
                            <span class="muted">—</span>
                        @endforelse
                    </td>
                    <td class="right mono">{{ $money($line->unit_cost) }}</td>
                    <td class="right mono">{{ rtrim(rtrim(number_format((float) $line->discount_percent, 2), '0'), '.') }}%</td>
                    <td class="right mono">{{ $money($line->total) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
@endsection

@section('totals')
    <tr class="grand"><td>Total</td><td class="right mono">{{ $money($total) }}</td></tr>
@endsection
