<?php

use App\Models\FefoOverrideCode;

test('a super admin can generate a short-lived single-use override code', function () {
    $superAdmin = assignStaffRole(makeStaffUser(), 'super_admin');

    $response = $this->actingAs($superAdmin, 'staff')->postJson('/api/staff/fefo-overrides');

    $response->assertCreated();
    $code = FefoOverrideCode::first();

    expect($response->json('code'))->toBe($code->code);
    expect(strlen($code->code))->toBe(8);
    expect($code->generated_by)->toBe($superAdmin->employee->id);
    expect($code->used)->toBeFalse();
    expect($code->expires_at->between(now()->addMinutes(14), now()->addMinutes(16)))->toBeTrue();
});

test('only a super admin can generate an override code', function () {
    foreach (['purchasing', 'admin', 'sales'] as $role) {
        $user = assignStaffRole(makeStaffUser(), $role);

        $this->actingAs($user, 'staff')->postJson('/api/staff/fefo-overrides')->assertForbidden();
    }

    expect(FefoOverrideCode::count())->toBe(0);
});
