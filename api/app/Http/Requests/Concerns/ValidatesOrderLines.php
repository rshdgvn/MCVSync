<?php

namespace App\Http\Requests\Concerns;

use Illuminate\Validation\Rule;

trait ValidatesOrderLines
{
    protected function orderLineRules(bool $staff, bool $required = true): array
    {
        $rules = [
            'items' => [$required ? 'required' : 'sometimes', 'array', 'min:1', 'max:100'],
            'items.*.item_id' => ['required', 'integer', 'distinct', Rule::exists('items', 'id')->where('is_active', true)],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:100000'],
        ];

        if ($staff) {
            $rules['items.*.discount_percent'] = ['nullable', 'numeric', 'min:0', 'max:100'];
            $rules['items.*.differs_from_request_reason'] = ['nullable', 'string', 'max:500'];
        }

        return $rules;
    }

    protected function orderLineMessages(): array
    {
        return [
            'items.required' => 'Add at least one item.',
            'items.*.item_id.exists' => 'Choose an active item.',
            'items.*.item_id.distinct' => 'Each item can only appear once. Change its quantity instead.',
        ];
    }
}
