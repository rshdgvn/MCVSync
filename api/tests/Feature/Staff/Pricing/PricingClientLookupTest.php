<?php

test('accounting can search clients for pricing, ordered by name with their zone', function () {
    $user = makeStaffUser();
    assignStaffRole($user, 'accounting');
    makeClientUser(['name' => 'Zamora Clinic'], 'Pampanga/Bulacan');
    makeClientUser(['name' => 'Alpha Hospital'], 'Metro Manila');
    makeClientUser(['name' => 'Beta Pharmacy'], 'Metro Manila');

    $all = $this->actingAs($user, 'staff')->getJson('/api/staff/pricing/clients');
    $all->assertOk();
    expect(collect($all->json('data'))->pluck('name')->all())->toBe(['Alpha Hospital', 'Beta Pharmacy', 'Zamora Clinic']);
    $all->assertJsonPath('data.0.zone.name', 'Metro Manila');

    $searched = $this->actingAs($user, 'staff')->getJson('/api/staff/pricing/clients?search=zamora');
    expect(collect($searched->json('data'))->pluck('name')->all())->toBe(['Zamora Clinic']);
});

test('roles that can read pricing can look up clients, others cannot', function () {
    makeClientUser(['name' => 'Alpha Hospital']);

    foreach (['accounting', 'sales', 'admin', 'super_admin'] as $role) {
        $user = assignStaffRole(makeStaffUser(), $role);
        $this->actingAs($user, 'staff')->getJson('/api/staff/pricing/clients')->assertOk();
    }

    foreach (['purchasing', 'logistics'] as $role) {
        $user = assignStaffRole(makeStaffUser(), $role);
        $this->actingAs($user, 'staff')->getJson('/api/staff/pricing/clients')->assertForbidden();
    }
});
