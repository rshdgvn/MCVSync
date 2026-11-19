@extends('documents.layout')

@section('lines')
    <table class="lines">
        <thead>
            <tr>
                <th class="micro">#</th>
                <th class="micro">Item</th>
                <th class="micro">Unit</th>
                <th class="micro right">Quantity</th>
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
                    <td class="right mono">{{ number_format($line->quantity_ordered) }}</td>
                    <td class="right mono">{{ $money($line->unit_cost) }}</td>
                    <td class="right mono">{{ $money($line->discount) }}</td>
                    <td class="right mono">{{ $money($line->total) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
@endsection

@section('totals')
    <tr><td class="muted">Subtotal</td><td class="right mono">{{ $money($subtotal) }}</td></tr>
    <tr><td class="muted">Discount</td><td class="right mono">{{ $money($discount) }}</td></tr>
    <tr class="grand"><td>Grand Total</td><td class="right mono">{{ $money($total) }}</td></tr>
@endsection
