<?php

namespace App\Http\Requests\Staff;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListTransfersRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'status' => ['nullable', Rule::in(['pending', 'shipped', 'closed', 'cancelled'])],
            'requesting_branch_id' => ['nullable', 'integer'],
            'fulfilling_branch_id' => ['nullable', 'integer'],
            'per_page' => ['nullable', 'integer', 'min:1'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }

    public function filters(): array
    {
        return [
            'status' => $this->validated('status'),
            'requesting_branch_id' => $this->filled('requesting_branch_id') ? $this->integer('requesting_branch_id') : null,
            'fulfilling_branch_id' => $this->filled('fulfilling_branch_id') ? $this->integer('fulfilling_branch_id') : null,
        ];
    }
}
