<?php

namespace App\Http\Requests\Staff;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;

class ConfirmReceivingRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            $this->lineField() => ['required', 'integer', $this->lineExistsRule()],
            'quantity_received' => ['required', 'integer', 'min:1'],
            'batch_number' => ['required', 'string', 'max:255'],
            'mfg_date' => ['nullable', 'date'],
            'expiry_date' => ['nullable', 'date'],
        ];
    }

    public function lineId(): int
    {
        return (int) $this->validated($this->lineField());
    }

    protected function lineField(): string
    {
        return 'purchase_order_item_id';
    }

    protected function lineExistsRule(): Exists
    {
        return Rule::exists('purchase_order_items', 'id')
            ->where('purchase_order_id', $this->route('purchaseOrder')->id);
    }
}
