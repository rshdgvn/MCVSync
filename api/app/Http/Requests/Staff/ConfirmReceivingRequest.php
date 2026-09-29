<?php

namespace App\Http\Requests\Staff;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ConfirmReceivingRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'purchase_order_item_id' => [
                'required',
                'integer',
                Rule::exists('purchase_order_items', 'id')
                    ->where('purchase_order_id', $this->route('purchaseOrder')->id),
            ],
            'quantity_received' => ['required', 'integer', 'min:1'],
            'batch_number' => ['required', 'string', 'max:255'],
            'mfg_date' => ['nullable', 'date'],
            'expiry_date' => ['nullable', 'date'],
        ];
    }
}
