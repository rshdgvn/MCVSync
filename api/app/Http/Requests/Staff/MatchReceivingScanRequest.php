<?php

namespace App\Http\Requests\Staff;

use Illuminate\Foundation\Http\FormRequest;

class MatchReceivingScanRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'barcode' => ['required_without:item_id', 'nullable', 'string'],
            'item_id' => ['required_without:barcode', 'nullable', 'integer', 'exists:items,id'],
        ];
    }
}
