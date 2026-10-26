<?php

use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

test('staff can log in with correct credentials and only the staff guard is authenticated', function () {
    $user = makeStaffUser();

    $response = $this->postJson('/api/staff/auth/login', [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $response->assertOk();
    $this->assertAuthenticated('staff');
    $this->assertGuest('client');
});

test('staff login fails with an incorrect password', function () {
    $user = makeStaffUser();

    $response = $this->postJson('/api/staff/auth/login', [
        'email' => $user->email,
        'password' => 'wrong-password',
    ]);

    $response->assertUnprocessable();
    $this->assertGuest('staff');
});

test('an inactive staff account is rejected at login even with correct credentials', function () {
    $user = makeStaffUser(['is_active' => false]);

    $response = $this->postJson('/api/staff/auth/login', [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $response->assertUnprocessable();
    $this->assertGuest('staff');
});

test('me returns the role, branch, and permissions for the authenticated staff user', function () {
    $user = makeStaffUser();
    $role = Role::firstOrCreate(['name' => 'sales', 'guard_name' => 'staff']);
    $permission = Permission::firstOrCreate(['name' => 'cof.create', 'guard_name' => 'staff']);
    $role->givePermissionTo($permission);
    $user->assignRole($role);

    $this->actingAs($user, 'staff');

    $response = $this->getJson('/api/staff/auth/me');

    $response->assertOk()
        ->assertJsonPath('email', $user->email)
        ->assertJsonPath('role', 'sales')
        ->assertJsonPath('branch.code', 'APALIT');

    expect($response->json('permissions'))->toContain('cof.create');
});

test('logout clears the staff session so protected routes reject further requests', function () {
    $user = makeStaffUser();

    $this->postJson('/api/staff/auth/login', [
        'email' => $user->email,
        'password' => 'password',
    ])->assertOk();

    $this->postJson('/api/staff/auth/logout')->assertOk();

    $this->assertGuest('staff');
    $this->getJson('/api/staff/auth/me')->assertUnauthorized();
});

test('staff login returns the same profile as me so the client can skip a round trip', function () {
    $user = makeStaffUser();
    assignStaffRole($user, 'purchasing');

    $login = $this->postJson('/api/staff/auth/login', ['email' => $user->email, 'password' => 'password']);

    $login->assertOk()->assertJsonPath('user.email', $user->email)->assertJsonPath('user.role', 'purchasing');
    expect($login->json('user'))->toEqual($this->getJson('/api/staff/auth/me')->json());
});
