<?php

namespace App\Http\Requests\Staff\Sales;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateClientRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'address' => ['sometimes', 'required', 'string', 'max:255'],
            'contact' => ['sometimes', 'required', 'string', 'max:255'],
            'zone_id' => ['sometimes', 'required', 'integer', 'exists:zones,id'],
            'client_type' => ['sometimes', 'required', Rule::in(['direct', 'reseller'])],
            'branch_id' => ['sometimes', 'required', 'integer', 'exists:branches,id'],
        ];
    }
}
