<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_order_forms', function (Blueprint $table) {
            $table->id();
            $table->string('cof_number')->unique();
            $table->string('dr_number')->nullable()->unique();
            $table->foreignId('client_id')->constrained()->restrictOnDelete();
            $table->foreignId('branch_id')->constrained()->restrictOnDelete();
            $table->enum('source_type', ['portal', 'manual']);
            $table->unsignedBigInteger('source_id');
            $table->enum('order_status', ['pending_approval', 'needs_revision', 'processing', 'ready_for_delivery', 'delivered', 'completed', 'cancelled'])
                ->default('pending_approval');
            $table->boolean('cancellation_requested')->default(false);
            $table->foreignId('prepared_by')->nullable()->constrained('employees')->nullOnDelete();
            $table->foreignId('checked_by')->nullable()->constrained('employees')->nullOnDelete();
            $table->string('terms')->nullable();
            $table->date('request_delivery_date')->nullable();
            $table->text('remarks')->nullable();
            $table->text('revision_reason')->nullable();
            $table->text('dispatch_hold_note')->nullable();
            $table->foreignId('dispatch_held_by')->nullable()->constrained('employees')->nullOnDelete();
            $table->timestamp('dispatch_held_at')->nullable();
            $table->text('issue_description')->nullable();
            $table->timestamp('issue_reported_at')->nullable();
            $table->timestamps();

            $table->unique(['source_type', 'source_id']);
            $table->index(['branch_id', 'order_status', 'created_at']);
            $table->index(['client_id', 'created_at']);
            $table->index(['order_status', 'cancellation_requested']);
        });

        Schema::create('client_order_form_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_order_form_id')->constrained()->cascadeOnDelete();
            $table->foreignId('item_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('quantity');
            $table->unsignedInteger('quantity_picked')->default(0);
            $table->decimal('unit_cost', 10, 2)->nullable();
            $table->decimal('discount_percent', 5, 2)->default(0);
            $table->decimal('total', 12, 2)->nullable();
            $table->boolean('differs_from_request')->default(false);
            $table->text('differs_from_request_reason')->nullable();
            $table->timestamps();

            $table->unique(['client_order_form_id', 'item_id']);
            $table->index('item_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_order_form_items');
        Schema::dropIfExists('client_order_forms');
    }
};
