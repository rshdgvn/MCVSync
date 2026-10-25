<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->string('reference_type');
            $table->unsignedBigInteger('reference_id');
            // Snapshotted at creation, never looked up live from the
            // referenced order — a later edit to the source order's terms
            // or total must not silently shift an already-tracked
            // payment's due status underneath it.
            $table->decimal('order_total', 10, 2);
            $table->string('payment_terms');
            $table->date('expected_payment_date')->nullable();
            $table->enum('status', ['payment_due', 'paid'])->default('payment_due');
            $table->enum('method', ['bank_transfer', 'check', 'cash', 'other'])->nullable();
            $table->date('date_received')->nullable();
            $table->string('reference_note')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('employees')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->index(['reference_type', 'reference_id']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
