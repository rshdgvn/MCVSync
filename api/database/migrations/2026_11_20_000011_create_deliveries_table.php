<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_order_forms', function (Blueprint $table) {
            $table->timestamp('ready_for_delivery_at')->nullable()->after('cancellation_requested');
            $table->index('ready_for_delivery_at');
        });

        DB::table('client_order_forms')
            ->whereIn('order_status', ['ready_for_delivery', 'delivered', 'completed'])
            ->update(['ready_for_delivery_at' => DB::raw('updated_at')]);

        Schema::create('deliveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_order_form_id')->unique()->constrained()->restrictOnDelete();
            $table->date('delivery_date');
            $table->string('received_by');
            $table->text('notes')->nullable();
            $table->foreignId('confirmed_by')->constrained('employees')->restrictOnDelete();
            $table->timestamps();

            $table->index('delivery_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deliveries');

        Schema::table('client_order_forms', function (Blueprint $table) {
            $table->dropIndex(['ready_for_delivery_at']);
            $table->dropColumn('ready_for_delivery_at');
        });
    }
};
