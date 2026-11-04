<?php

use App\Models\Supplier;

test('purchasing can list, create, update, deactivate, and reactivate a supplier', function () {
    $user = makeStaffUser();
    assignStaffRole($user, 'purchasing');

    $create = $this->actingAs($user, 'staff')->postJson('/api/staff/suppliers', [
        'name' => 'Acme Medical Supplies',
        'contact_person' => 'Jane Doe',
        'phone' => '09171234567',
        'email' => 'jane@acme.test',
        'address' => '123 Main St',
    ]);
    $create->assertCreated();
    $create->assertJsonPath('name', 'Acme Medical Supplies');
    $create->assertJsonPath('is_active', true);
    $supplierId = $create->json('id');

    $list = $this->actingAs($user, 'staff')->getJson('/api/staff/suppliers');
    $list->assertOk();
    expect(collect($list->json('data'))->pluck('id'))->toContain($supplierId);

    $update = $this->actingAs($user, 'staff')->patchJson("/api/staff/suppliers/{$supplierId}", [
        'name' => 'Acme Medical Supplies Inc.',
    ]);
    $update->assertOk();
    $update->assertJsonPath('name', 'Acme Medical Supplies Inc.');

    $deactivate = $this->actingAs($user, 'staff')->postJson("/api/staff/suppliers/{$supplierId}/deactivate");
    $deactivate->assertOk();
    $deactivate->assertJsonPath('is_active', false);

    $activate = $this->actingAs($user, 'staff')->postJson("/api/staff/suppliers/{$supplierId}/activate");
    $activate->assertOk();
    $activate->assertJsonPath('is_active', true);
});

test('admin and super admin also have full write access to suppliers', function () {
    $admin = makeStaffUser();
    assignStaffRole($admin, 'admin');
    $this->actingAs($admin, 'staff')
        ->postJson('/api/staff/suppliers', ['name' => 'Admin-created Supplier'])
        ->assertCreated();

    $superAdmin = makeStaffUser();
    assignStaffRole($superAdmin, 'super_admin');
    $this->actingAs($superAdmin, 'staff')
        ->postJson('/api/staff/suppliers', ['name' => 'Super-admin-created Supplier'])
        ->assertCreated();
});

test('sales, accounting, and logistics have no access to suppliers at all', function () {
    foreach (['sales', 'accounting', 'logistics'] as $role) {
        $user = makeStaffUser();
        assignStaffRole($user, $role);

        $this->actingAs($user, 'staff')->getJson('/api/staff/suppliers')->assertForbidden();
    }
});

test('a deactivated supplier no longer accepts writes from a blocked role but stays visible to purchasing', function () {
    $user = makeStaffUser();
    assignStaffRole($user, 'purchasing');

    $supplier = Supplier::factory()->create(['is_active' => false]);

    $response = $this->actingAs($user, 'staff')->getJson('/api/staff/suppliers');
    $response->assertOk();
    expect(collect($response->json('data'))->pluck('id'))->toContain($supplier->id);
});

test('suppliers list is searchable by name', function () {
    $user = makeStaffUser();
    assignStaffRole($user, 'purchasing');

    $acme = Supplier::factory()->create(['name' => 'Acme Medical Supplies']);
    $globex = Supplier::factory()->create(['name' => 'Globex Pharmaceuticals']);

    $response = $this->actingAs($user, 'staff')->getJson('/api/staff/suppliers?search=Acme');

    $ids = collect($response->json('data'))->pluck('id');
    expect($ids)->toContain($acme->id)->not->toContain($globex->id);
});

test('creating a supplier only requires a name', function () {
    $user = makeStaffUser();
    assignStaffRole($user, 'purchasing');

    $response = $this->actingAs($user, 'staff')->postJson('/api/staff/suppliers', [
        'name' => 'Minimal Supplier',
    ]);

    $response->assertCreated();
    $response->assertJsonPath('contact_person', null);
});

test('creating a supplier without a name is rejected', function () {
    $user = makeStaffUser();
    assignStaffRole($user, 'purchasing');

    $response = $this->actingAs($user, 'staff')->postJson('/api/staff/suppliers', []);

    $response->assertUnprocessable();
    $response->assertJsonValidationErrors('name');
});

test('suppliers list filters by active status and returns status counts that follow the search', function () {
    $user = makeStaffUser();
    assignStaffRole($user, 'purchasing');

    $activeAcme = Supplier::factory()->create(['name' => 'Acme Active', 'is_active' => true]);
    $inactiveAcme = Supplier::factory()->create(['name' => 'Acme Inactive', 'is_active' => false]);
    Supplier::factory()->create(['name' => 'Globex Active', 'is_active' => true]);

    $inactive = $this->actingAs($user, 'staff')->getJson('/api/staff/suppliers?is_active=0');
    $inactive->assertOk();
    expect(collect($inactive->json('data'))->pluck('id')->all())->toBe([$inactiveAcme->id]);
    $inactive->assertJsonPath('counts', ['all' => 3, 'active' => 2, 'inactive' => 1]);

    $searched = $this->actingAs($user, 'staff')->getJson('/api/staff/suppliers?search=Acme&is_active=1');
    $searched->assertOk();
    expect(collect($searched->json('data'))->pluck('id')->all())->toBe([$activeAcme->id]);
    $searched->assertJsonPath('counts', ['all' => 2, 'active' => 1, 'inactive' => 1]);
});
