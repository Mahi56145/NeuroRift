// app/api/cache-clear/route.ts
// POST /api/cache-clear?datasetId=... - clear cache for a specific dataset
// POST /api/cache-clear?all=true - clear ALL cached data

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const datasetId = searchParams.get("datasetId");
    const clearAll = searchParams.get("all") === "true";

    if (clearAll) {
      // Clear ALL cache
      const { error } = await supabaseAdmin
        .from("dataset_enrichment")
        .delete()
        .neq("id", "");
      
      if (error) throw error;
      return NextResponse.json({ success: true, message: "All cache cleared" });
    } else if (datasetId) {
      // Clear specific dataset cache
      const { error } = await supabaseAdmin
        .from("dataset_enrichment")
        .delete()
        .eq("dataset_id", datasetId);
      
      if (error) throw error;
      return NextResponse.json({ success: true, message: `Cache cleared for ${datasetId}` });
    } else {
      return NextResponse.json(
        { error: "Provide datasetId or all=true" },
        { status: 400 }
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Cache clear failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
