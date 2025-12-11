import { evaluate } from "langsmith/evaluation";
import { Client } from "langsmith";
import { wrapOpenAI } from "langsmith/wrappers/openai";
import OpenAI from "openai";
import { createLLMAsJudge, CORRECTNESS_PROMPT } from "openevals";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { runResearch } from "@/agent/agent.js";

dotenv.config();

// ES module equivalents for __dirname and __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * LangSmith Evaluation for Research Agent
 */

const client = new Client();
const openaiClient = wrapOpenAI(new OpenAI());

/**
 * TARGET FUNCTION
 */
async function target(inputs: Record<string, any>): Promise<Record<string, any>> {
  const question = String(inputs.question ?? "");
  
  console.log(`\n📝 Evaluating question: ${question}`);
  
  const result = await runResearch(question);
  
  return {
    report: result.report,
    searchResults: result.searchResults,
    metadata: result.metadata,
  };
}

/**
 * EVALUATOR 1: Correctness
 */
const correctnessJudge = createLLMAsJudge({
  prompt: CORRECTNESS_PROMPT,
  model: "openai:gpt-4o-mini",
  feedbackKey: "correctness",
});

async function correctnessEvaluator(run: {
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  referenceOutputs?: Record<string, any>;
}) {
  return correctnessJudge({
    inputs: run.inputs,
    outputs: { answer: run.outputs.report },
    reference_outputs: run.referenceOutputs,
  });
}

/**
 * EVALUATOR 2: Citation Quality
 */
async function citationEvaluator(run: {
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  referenceOutputs?: Record<string, any>;
}) {
  const report = run.outputs.report || "";
  const searchResults = run.outputs.searchResults || [];

  const citationMatches = report.match(/\[\d+\]/g);
  const numCitations = citationMatches ? citationMatches.length : 0;
  const numSources = searchResults.length;

  let score = 0;
  let comment = "";

  if (numCitations === 0) {
    score = 0;
    comment = "No citations found in report";
  } else if (numSources === 0) {
    score = 0;
    comment = "Citations present but no sources collected";
  } else {
    score = Math.min(numCitations / 3, 1.0);
    comment = `${numCitations} citations from ${numSources} sources`;
  }

  return {
    key: "citation_quality",
    score,
    comment,
  };
}

/**
 * EVALUATOR 3: Completeness
 */
async function completenessEvaluator(run: {
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  referenceOutputs?: Record<string, any>;
}) {
  const report = (run.outputs.report || "").toLowerCase();
  const expectedChars = run.referenceOutputs?.expected_characteristics;

  if (!expectedChars?.should_include) {
    return {
      key: "completeness",
      score: 1.0,
      comment: "No expected terms defined",
    };
  }

  const shouldInclude: string[] = expectedChars.should_include;
  const foundTerms = shouldInclude.filter((term) =>
    report.includes(term.toLowerCase())
  );

  const score = foundTerms.length / shouldInclude.length;
  const comment = `Found ${foundTerms.length}/${shouldInclude.length} expected terms`;

  return {
    key: "completeness",
    score,
    comment,
  };
}

/**
 * EVALUATOR 4: Performance Metrics
 */
async function performanceEvaluator(run: {
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  referenceOutputs?: Record<string, any>;
}) {
  const metadata = run.outputs.metadata;

  if (!metadata) {
    return {
      key: "performance",
      score: 0,
      comment: "No metadata available",
    };
  }

  const duration = (metadata.endTime - metadata.startTime) / 1000;
  const searchResults = run.outputs.searchResults?.length || 0;

  let score = 1.0;

  if (duration > 60) {
    score -= 0.3;
  } else if (duration > 30) {
    score -= 0.1;
  }

  if (searchResults < 3) {
    score -= 0.3;
  }

  score = Math.max(0, score);

  return {
    key: "performance",
    score,
    comment: `${duration.toFixed(1)}s, ${searchResults} sources`,
  };
}

/**
 * CREATE OR LOAD DATASET
 */
async function setupDataset() {
  const datasetName = "research-agent-questions";

  try {
    const dataset = await client.readDataset({ datasetName });
    console.log(`✓ Using existing dataset: ${datasetName}\n`);
    console.log(`  Dataset ID: ${dataset.id}\n`);
    return dataset;
  } catch {
    console.log(`Creating new dataset: ${datasetName}...`);

    const dataset = await client.createDataset(datasetName, {
      description: "Research questions for evaluating the research agent",
    });

    const datasetPath = path.join(__dirname, "./datasets/research-questions.json");
    const rawData = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));

    const inputs = rawData.map((item: any) => ({ question: item.question }));
    const outputs = rawData.map((item: any) => ({
      expected_characteristics: item.expected_characteristics,
    }));

    await client.createExamples({
      datasetId: dataset.id,
      inputs,
      outputs,
    });

    console.log(`✓ Dataset created with ${rawData.length} examples\n`);
    return dataset;
  }
}

/**
 * MAIN EVALUATION FUNCTION
 */
async function runEvaluation() {
  console.log("🧪 Starting LangSmith Evaluation\n");

  const dataset = await setupDataset();

  console.log("🚀 Running evaluation experiment...\n");
  console.log("This will:");
  console.log("1. Run the agent on each test case");
  console.log("2. Apply evaluators (correctness, citations, completeness, performance)");
  console.log("3. Upload results to LangSmith");
  console.log("\nThis may take a few minutes...\n");

  const results = await evaluate(target, {
    data: dataset.name,
    evaluators: [
      correctnessEvaluator,
      citationEvaluator,
      completenessEvaluator,
      performanceEvaluator,
    ],
    experimentPrefix: "research-agent-eval",
    maxConcurrency: 2,
    metadata: {
      version: "1.0",
      description: "Baseline evaluation of research agent",
    },
  });

  console.log("\n✅ Evaluation complete!\n");
  console.log("=".repeat(80));
  console.log("📊 RESULTS SUMMARY");
  console.log("=".repeat(80) + "\n");

  console.log("View detailed results in LangSmith at the link above\n");

  console.log("=".repeat(80) + "\n");

  console.log("Next steps:");
  console.log("1. Open the LangSmith UI to view detailed results");
  console.log("2. Compare runs across different test cases");
  console.log("3. Identify failure patterns");
  console.log("4. Iterate on agent design or prompts");
  console.log("5. Re-run evaluation to measure improvements\n");

  return results;
}

// ALWAYS RUN - Remove the conditional check entirely
runEvaluation().catch((error) => {
  console.error("❌ Evaluation failed:", error);
  process.exit(1);
});

export { runEvaluation };