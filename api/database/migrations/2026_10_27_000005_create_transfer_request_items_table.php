<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transfer_request_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('transfer_request_id')->constrained()->cascadeOnDelete();
            $table->foreignId('item_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('quantity_requested');
            $table->unsignedInteger('quantity_picked')->default(0);
            $table->unsignedInteger('quantity_received')->default(0);
            $table->timestamps();

            $table->unique(['transfer_request_id', 'item_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transfer_request_items');
    }
};
