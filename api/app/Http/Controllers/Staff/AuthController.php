<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Concerns\AuthenticatesGuard;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    use AuthenticatesGuard;

    protected function guardName(): string
    {
        return 'staff';
    }

    public function me(Request $request)
    {
        return response()->json($this->profile($request->user('staff')));
    }

    protected function profile(User $user): array
    {
        $employee = $user->employee()->with('branch')->first();

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->getRoleNames()->first(),
            'position' => $employee?->position,
            'branch' => $employee?->branch,
            'permissions' => $user->getAllPermissions()->pluck('name'),
        ];
    }
}
