<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Concerns\AuthenticatesGuard;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    use AuthenticatesGuard;

    protected function guardName(): string
    {
        return 'client';
    }

    public function me(Request $request)
    {
        return response()->json($this->profile($request->user('client')));
    }

    protected function profile(User $user): array
    {
        $client = $user->client()->with('zone')->first();

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'client_type' => $client?->client_type,
            'zone' => $client?->zone,
        ];
    }
}
