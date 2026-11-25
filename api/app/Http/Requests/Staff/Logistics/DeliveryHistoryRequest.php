<?php

namespace App\Http\Requests\Staff\Logistics;

use Illuminate\Foundation\Http\FormRequest;

class DeliveryHistoryRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ];
    }
}
