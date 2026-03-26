// lib/ai/enrichDataset.ts
// Central dataset enrichment service using Groq AI
// Caches results in Supabase to avoid repeated regeneration
// Rich fields (pros, cons, difficulty, models, etc.) now come directly from Groq via analyzeDataset()

import { analyzeDataset, DatasetAnalysis } from "@/lib/groq";
import { supabaseAdmin } from "@/lib/supabase-admin";

export interface EnrichedDataset extends DatasetAnalysis {
  difficulty: string;
  preprocessingEffort: string;
  recommendedModels: string[];
  pros: string[];
  cons: string[];
  updated_at: string;
}

export async function enrichDataset(
  datasetId: string,
  params: {
    name: string;
    category: string;
    rows?: number | null;
    cols?: number | null;
    size?: string | null;
    votes?: number | null;
    forceRefresh?: boolean;
  }
): Promise<EnrichedDataset | null> {
  const { name, category, rows, cols, size, votes, forceRefresh = false } = params;

  try {
    // Check if enrichment already exists and is fresh (< 7 days)
    if (!forceRefresh) {
      const { data: existing } = await supabaseAdmin
        .from("dataset_enrichment")
        .select("*")
        .eq("dataset_id", datasetId)
        .single();

      if (existing) {
        const createdAt = new Date(existing.created_at).getTime();
        const ageDays = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
        if (ageDays < 7) {
          return {
            description: existing.description,
            score: existing.score,
            tags: existing.tags,
            use_cases: existing.use_cases,
            difficulty: existing.difficulty ?? "Medium",
            preprocessingEffort: existing.preprocessing_effort ?? "Medium",
            recommendedModels: existing.recommended_models ?? [],
            pros: existing.pros ?? [],
            cons: existing.cons ?? [],
            completeness: existing.completeness,
            biasWarnings: existing.bias_warnings ?? [],
            trainingReadiness: existing.training_readiness,
            businessValue: existing.business_value,
            statisticalProfile: existing.statistical_profile,
            updated_at: existing.updated_at,
          };
        }
      }
    }

    // Call Groq for fresh full analysis — all rich fields come back from Groq now
    const analysis = await analyzeDataset({ name, category, rows, cols, size, votes });

    const enriched: EnrichedDataset = {
      ...analysis,
      difficulty: analysis.difficulty ?? "Medium",
      preprocessingEffort: analysis.preprocessingEffort ?? "Medium",
      recommendedModels: analysis.recommendedModels ?? [],
      pros: analysis.pros ?? [],
      cons: analysis.cons ?? [],
      updated_at: new Date().toISOString(),
    };

    // Cache in Supabase
    try {
      await supabaseAdmin.from("dataset_enrichment").upsert({
        dataset_id: datasetId,
        description: enriched.description,
        score: enriched.score,
        tags: enriched.tags,
        use_cases: enriched.use_cases,
        difficulty: enriched.difficulty,
        preprocessing_effort: enriched.preprocessingEffort,
        recommended_models: enriched.recommendedModels,
        pros: enriched.pros,
        cons: enriched.cons,
        completeness: enriched.completeness,
        bias_warnings: enriched.biasWarnings,
        training_readiness: enriched.trainingReadiness,
        business_value: enriched.businessValue,
        statistical_profile: enriched.statisticalProfile,
        created_at: new Date().toISOString(),
        updated_at: enriched.updated_at,
      });
    } catch (dbErr) {
      console.error("Supabase cache update error:", dbErr);
    }

    return enriched;
  } catch {
    return null;
  }
}

export async function getEnrichedDataset(
  datasetId: string
): Promise<EnrichedDataset | null> {
  try {
    const { data } = await supabaseAdmin
      .from("dataset_enrichment")
      .select("*")
      .eq("dataset_id", datasetId)
      .single();

    if (!data) return null;

    return {
      description: data.description,
      score: data.score,
      tags: data.tags,
      use_cases: data.use_cases,
      difficulty: data.difficulty ?? "Medium",
      preprocessingEffort: data.preprocessing_effort ?? "Medium",
      recommendedModels: data.recommended_models ?? [],
      pros: data.pros ?? [],
      cons: data.cons ?? [],
      completeness: data.completeness,
      biasWarnings: data.bias_warnings ?? [],
      trainingReadiness: data.training_readiness,
      businessValue: data.business_value,
      statisticalProfile: data.statistical_profile,
      updated_at: data.updated_at,
    };
  } catch {
    return null;
  }
}
