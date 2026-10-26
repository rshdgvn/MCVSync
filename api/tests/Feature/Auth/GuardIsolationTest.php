<?php

test('a client account cannot authenticate against the staff login endpoint', function () {
    $client = makeClientUser();

    $response = $this->postJson('/api/staff/auth/login', [
        'email' => $client->email,
        'password' => 'password',
    ]);

    $response->assertUnprocessable();
    $this->assertGuest('staff');
    $this->assertGuest('client');
});

test('a staff account cannot authenticate against the portal login endpoint', function () {
    $staff = makeStaffUser();

    $response = $this->postJson('/api/portal/auth/login', [
        'email' => $staff->email,
        'password' => 'password',
    ]);

    $response->assertUnprocessable();
    $this->assertGuest('staff');
    $this->assertGuest('client');
});

test('the client guard provider cannot retrieve a staff-type user by credentials', function () {
    $staff = makeStaffUser();

    $found = auth()->guard('client')->getProvider()->retrieveByCredentials([
        'email' => $staff->email,
    ]);

    expect($found)->toBeNull();
});

test('the staff guard provider cannot retrieve a client-type user by credentials', function () {
    $client = makeClientUser();

    $found = auth()->guard('staff')->getProvider()->retrieveByCredentials([
        'email' => $client->email,
    ]);

    expect($found)->toBeNull();
});

test('an unauthenticated api request without a json accept header gets a 401, not a login redirect', function () {
    $this->get('/api/staff/auth/me')->assertUnauthorized()->assertJson(['message' => 'Unauthenticated.']);
    $this->get('/api/portal/auth/me')->assertUnauthorized()->assertJson(['message' => 'Unauthenticated.']);
});
