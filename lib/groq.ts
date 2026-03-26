// lib/groq.ts
// Groq AI client for dataset intelligence analysis
// Install: npm install groq-sdk

import { computeDatasetScore } from "@/lib/dataset-score";
import Groq from "groq-sdk";

let groqInstance: Groq | null = null;

function getGroq(): Groq {
  if (!groqInstance) {
    groqInstance = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "" });
  }
  return groqInstance;
}

export interface DatasetAnalysis {
  description: string;
  score: number;
  tags: string[];
  use_cases: string[];
  // Rich fields – populated by Groq
  difficulty?: string;
  preprocessingEffort?: string;
  recommendedModels?: string[];
  pros?: string[];
  cons?: string[];
  completeness?: number;
  biasWarnings?: string[];
  trainingReadiness?: string;
  businessValue?: string;
  statisticalProfile?: string;
}

function fallbackAnalysis(params: {
  name: string;
  category: string;
  rows?: number | null;
  cols?: number | null;
  size?: string | null;
  votes?: number | null;
}): DatasetAnalysis {
  const { name, category, rows, cols, size, votes } = params;
  const source = votes && votes > 0 ? "kaggle" : "upload";
  const score = computeDatasetScore({ source, votes, rows, cols, size, name, category });

  return {
    description: `${name} is a ${category} dataset useful for machine learning and data analysis tasks${rows ? ` with approximately ${rows.toLocaleString()} rows` : ""}${cols ? ` and ${cols} columns` : ""}${size ? ` (${size})` : ""}.`,
    score,
    tags: [category.toLowerCase(), "dataset", "ml"],
    use_cases: ["supervised learning", "feature engineering", "exploratory analysis"],
    difficulty: score > 80 ? "Easy" : score > 60 ? "Medium" : "Hard",
    preprocessingEffort: (rows ?? 0) > 100000 || (cols ?? 0) > 50 ? "High" : score > 80 ? "Low" : "Medium",
    recommendedModels: ["XGBoost", "Random Forest", "Neural Network"],
    pros: score > 75 ? ["Decent quality signal", "Multiple use cases"] : ["Baseline dataset available"],
    cons: score < 70 ? ["Preprocessing required", "May need cleaning"] : ["Limited documentation"],
    completeness: Math.min(100, 40 + score * 0.5),
    biasWarnings: [],
    trainingReadiness: score > 75 ? "Production Ready" : score > 55 ? "Needs Preprocessing" : "Significant Cleaning Required",
    businessValue: `${name} can provide value for data-driven decisions in the ${category} domain.`,
    statisticalProfile: `Dataset contains ${rows?.toLocaleString() ?? "unknown"} records across ${cols ?? "unknown"} features.`,
  };
}

export async function analyzeDataset(params: {
  name: string;
  category: string;
  rows?: number | null;
  cols?: number | null;
  size?: string | null;
  votes?: number | null;
}): Promise<DatasetAnalysis> {
  const { name, category, rows, cols, size, votes } = params;

  if (!process.env.GROQ_API_KEY) {
    return fallbackAnalysis(params);
  }

  const prompt = `You are a senior data scientist. Analyze the following dataset and return a comprehensive intelligence report as JSON.

Dataset details:
- Name: ${name}
- Category: ${category}
- Rows: ${rows ?? "unknown"}
- Columns: ${cols ?? "unknown"}
- Size: ${size ?? "unknown"}
- Community votes: ${votes ?? 0}

Return ONLY valid JSON — no markdown, no code blocks, no extra text. Use this EXACT shape:
{
  "description": "2-3 informative sentences about what this dataset contains and what problems it helps solve",
  "score": <integer 40-100 reflecting data quality, size, specificity>,
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "use_cases": ["specific use case 1", "specific use case 2", "specific use case 3"],
  "difficulty": "Easy",
  "preprocessingEffort": "Low",
  "recommendedModels": ["Model 1 (reason)", "Model 2 (reason)", "Model 3 (reason)"],
  "pros": ["strength 1", "strength 2", "strength 3"],
  "cons": ["limitation 1", "limitation 2"],
  "completeness": <integer 0-100>,
  "biasWarnings": ["potential bias if any"],
  "trainingReadiness": "Production Ready",
  "businessValue": "1-2 sentences on business or research value",
  "statisticalProfile": "1-2 sentences on statistical properties and distribution"
}

difficulty must be exactly one of: "Easy", "Medium", "Hard"
preprocessingEffort must be exactly one of: "Low", "Medium", "High"
trainingReadiness must be exactly one of: "Production Ready", "Needs Preprocessing", "Significant Cleaning Required"
biasWarnings: list real potential biases (sampling bias, demographic bias, temporal drift) or empty array []
score: weight community votes heavily (>1000 votes = 80+), consider size and specificity
Be specific and informative — avoid generic answers`;

  let completion: { choices?: Array<{ message?: { content?: string | null } }> } | null = null;
  try {
    const groq = getGroq();
    completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are a data science expert. Always respond with valid JSON only. No markdown, no code fences, no extra text before or after the JSON object.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.35,
      max_tokens: 900,
    });
  } catch (error: any) {
    console.error("[Groq] analyzeDataset failed:", error);
    return fallbackAnalysis(params);
  }

  const raw = completion?.choices?.[0]?.message?.content ?? "{}";
  // Strip markdown fences if Groq wraps anyway
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  let parsed: Partial<DatasetAnalysis> = {};
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to extract the first JSON object substring
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch { parsed = {}; }
    }
  }

  const fallback = fallbackAnalysis(params);

  return {
    description:
      typeof parsed.description === "string" && parsed.description.length > 10
        ? parsed.description : fallback.description,
    score:
      typeof parsed.score === "number" && parsed.score >= 0 && parsed.score <= 100
        ? Math.round(parsed.score) : fallback.score,
    tags:
      Array.isArray(parsed.tags) && parsed.tags.length > 0
        ? parsed.tags.slice(0, 6).map(String) : fallback.tags,
    use_cases:
      Array.isArray(parsed.use_cases) && parsed.use_cases.length > 0
        ? parsed.use_cases.slice(0, 5).map(String) : fallback.use_cases,
    difficulty:
      ["Easy", "Medium", "Hard"].includes(parsed.difficulty ?? "")
        ? parsed.difficulty : fallback.difficulty,
    preprocessingEffort:
      ["Low", "Medium", "High"].includes(parsed.preprocessingEffort ?? "")
        ? parsed.preprocessingEffort : fallback.preprocessingEffort,
    recommendedModels:
      Array.isArray(parsed.recommendedModels) && parsed.recommendedModels.length > 0
        ? parsed.recommendedModels.slice(0, 5).map(String) : fallback.recommendedModels,
    pros:
      Array.isArray(parsed.pros) && parsed.pros.length > 0
        ? parsed.pros.slice(0, 5).map(String) : fallback.pros,
    cons:
      Array.isArray(parsed.cons)
        ? parsed.cons.slice(0, 5).map(String) : fallback.cons,
    completeness:
      typeof parsed.completeness === "number"
        ? Math.min(100, Math.max(0, parsed.completeness)) : fallback.completeness,
    biasWarnings:
      Array.isArray(parsed.biasWarnings)
        ? parsed.biasWarnings.slice(0, 4).map(String) : fallback.biasWarnings,
    trainingReadiness:
      typeof parsed.trainingReadiness === "string" && parsed.trainingReadiness.length > 2
        ? parsed.trainingReadiness : fallback.trainingReadiness,
    businessValue:
      typeof parsed.businessValue === "string" && parsed.businessValue.length > 5
        ? parsed.businessValue : fallback.businessValue,
    statisticalProfile:
      typeof parsed.statisticalProfile === "string" && parsed.statisticalProfile.length > 5
        ? parsed.statisticalProfile : fallback.statisticalProfile,
  };
}