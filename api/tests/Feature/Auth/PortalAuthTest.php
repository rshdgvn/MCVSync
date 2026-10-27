<?php

test('a client can log in with correct credentials and only the client guard is authenticated', function () {
    $user = makeClientUser();

    $response = $this->postJson('/api/portal/auth/login', [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $response->assertOk();
    $this->assertAuthenticated('client');
    $this->assertGuest('staff');
});

test('client login fails with an incorrect password', function () {
    $user = makeClientUser();

    $response = $this->postJson('/api/portal/auth/login', [
        'email' => $user->email,
        'password' => 'wrong-password',
    ]);

    $response->assertUnprocessable();
    $this->assertGuest('client');
});

test('an inactive client account is rejected at login even with correct credentials', function () {
    $user = makeClientUser(['is_active' => false]);

    $response = $this->postJson('/api/portal/auth/login', [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $response->assertUnprocessable();
    $this->assertGuest('client');
});

test('me returns the client record, client type, and zone for the authenticated client', function () {
    $user = makeClientUser();

    $this->actingAs($user, 'client');

    $response = $this->getJson('/api/portal/auth/me');

    $response->assertOk()
        ->assertJsonPath('email', $user->email)
        ->assertJsonPath('client_type', 'direct')
        ->assertJsonPath('zone.name', 'Pampanga/Bulacan');
});

test('logout clears the client session so protected routes reject further requests', function () {
    $user = makeClientUser();

    $this->postJson('/api/portal/auth/login', [
        'email' => $user->email,
        'password' => 'password',
    ])->assertOk();

    $this->postJson('/api/portal/auth/logout')->assertOk();

    $this->assertGuest('client');
    $this->getJson('/api/portal/auth/me')->assertUnauthorized();
});

test('client login returns the same profile as me so the client can skip a round trip', function () {
    $user = makeClientUser();

    $login = $this->postJson('/api/portal/auth/login', ['email' => $user->email, 'password' => 'password']);

    $login->assertOk()->assertJsonPath('user.email', $user->email);
    expect($login->json('user'))->toEqual($this->getJson('/api/portal/auth/me')->json());
});
