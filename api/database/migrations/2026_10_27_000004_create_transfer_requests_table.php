<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transfer_requests', function (Blueprint $table) {
            $table->id();
            $table->string('transfer_number')->unique();
            $table->foreignId('requesting_branch_id')->constrained('branches')->restrictOnDelete();
            $table->foreignId('fulfilling_branch_id')->constrained('branches')->restrictOnDelete();
            $table->enum('status', ['pending', 'shipped', 'closed', 'cancelled'])->default('pending');
            $table->foreignId('requested_by')->constrained('employees')->restrictOnDelete();
            $table->timestamp('shipped_at')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->text('remarks')->nullable();
            $table->timestamps();

            $table->index(['requesting_branch_id', 'status']);
            $table->index(['fulfilling_branch_id', 'status']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transfer_requests');
    }
};
