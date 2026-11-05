<?php

namespace App\Http\Controllers\Concerns;

use App\Models\User;
use App\Services\AuditLogger;
use App\Services\AuthLockoutService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

trait AuthenticatesGuard
{
    abstract protected function guardName(): string;

    abstract protected function profile(User $user): array;

    public function login(Request $request, AuthLockoutService $lockout, AuditLogger $audit)
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'remember' => ['sometimes', 'boolean'],
        ]);

        $credentials = ['email' => $validated['email'], 'password' => $validated['password']];

        $guard = $this->guardName();
        $email = $credentials['email'];

        if ($lockout->isLocked($guard, $email)) {
            throw ValidationException::withMessages([
                'email' => 'Too many failed attempts. Please try again later.',
            ]);
        }

        if (! Auth::guard($guard)->attempt($credentials, $request->boolean('remember'))) {
            $lockout->recordFailure($guard, $email);
            $audit->record('login.failed', null, $guard, ['email' => $email]);

            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        $user = Auth::guard($guard)->user();

        if (! $user->is_active) {
            Auth::guard($guard)->logout();
            $request->session()->invalidate();
            $audit->record('login.rejected_inactive', $user, $guard);

            throw ValidationException::withMessages([
                'email' => 'This account has been deactivated.',
            ]);
        }

        $lockout->clear($guard, $email);
        $request->session()->regenerate();
        $audit->record('login.success', $user, $guard);

        return response()->json(['message' => 'Logged in.', 'user' => $this->profile($user)]);
    }

    public function logout(Request $request, AuditLogger $audit)
    {
        $guard = $this->guardName();
        $user = Auth::guard($guard)->user();

        Auth::guard($guard)->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        $audit->record('logout', $user, $guard);

        return response()->json(['message' => 'Logged out.']);
    }
}
