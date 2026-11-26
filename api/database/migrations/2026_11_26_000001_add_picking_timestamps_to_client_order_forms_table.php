<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const FORWARDED_STATUSES = ['processing', 'ready_for_delivery', 'delivered', 'completed'];

    public function up(): void
    {
        Schema::table('client_order_forms', function (Blueprint $table) {
            $table->timestamp('forwarded_at')->nullable()->after('cancellation_requested');
            $table->timestamp('picking_completed_at')->nullable()->after('forwarded_at');
            $table->index(['branch_id', 'order_status', 'picking_completed_at', 'request_delivery_date', 'forwarded_at'], 'client_order_forms_pick_queue_index');
        });

        DB::table('client_order_forms')
            ->whereIn('order_status', self::FORWARDED_STATUSES)
            ->update(['forwarded_at' => DB::raw('created_at')]);

        DB::table('client_order_forms')
            ->whereNotNull('ready_for_delivery_at')
            ->update(['picking_completed_at' => DB::raw('ready_for_delivery_at')]);

        DB::table('client_order_forms')
            ->where('order_status', 'processing')
            ->whereExists(fn (Builder $query) => $query
                ->select(DB::raw(1))
                ->from('discrepancies')
                ->where('discrepancies.reference_type', 'client_order_form')
                ->whereColumn('discrepancies.reference_id', 'client_order_forms.id'))
            ->update(['picking_completed_at' => DB::raw('updated_at')]);
    }

    public function down(): void
    {
        Schema::table('client_order_forms', function (Blueprint $table) {
            $table->dropIndex('client_order_forms_pick_queue_index');
            $table->dropColumn(['forwarded_at', 'picking_completed_at']);
        });
    }
};
