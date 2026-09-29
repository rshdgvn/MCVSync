<?php

namespace App\Http\Requests\Staff;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Only header fields Purchasing can actually revise after creation —
 * supplier, branch, and order_date are intentionally not editable here.
 */
class UpdatePurchaseOrderRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'request_delivery_date' => ['nullable', 'date'],
            'terms' => ['nullable', 'string', 'max:255'],
            'remarks' => ['nullable', 'string'],
        ];
    }
}
