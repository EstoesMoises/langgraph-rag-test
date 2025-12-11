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
    isValidQuestion: result.isValidQuestion,
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
  const metadata = run.referenceOutputs?.metadata;
  
  // Skip correctness check for invalid questions
  if (metadata?.expected_valid === false) {
    return {
      key: "correctness",
      score: 1.0,
      comment: "Skipped (invalid question)",
    };
  }

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
  const metadata = run.referenceOutputs?.metadata;
  
  // Skip citation check for invalid questions
  if (metadata?.expected_valid === false) {
    return {
      key: "citation_quality",
      score: 1.0,
      comment: "Skipped (invalid question)",
    };
  }

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
  const metadata = run.referenceOutputs?.metadata;
  
  // Skip completeness check for invalid questions
  if (metadata?.expected_valid === false) {
    return {
      key: "completeness",
      score: 1.0,
      comment: "Skipped (invalid question)",
    };
  }

  const shouldInclude: string[] = metadata?.should_include || [];

  if (shouldInclude.length === 0) {
    return {
      key: "completeness",
      score: 1.0,
      comment: "No expected terms defined",
    };
  }

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
 * EVALUATOR 5: Validation Quality
 * Checks if the agent correctly identifies and handles invalid questions
 */
async function validationEvaluator(run: {
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  referenceOutputs?: Record<string, any>;
}) {
  const metadata = run.referenceOutputs?.metadata;
  const report = run.outputs.report || "";
  
  // If no validation expectations, skip this evaluator
  if (metadata?.expected_valid === undefined) {
    return {
      key: "validation_quality",
      score: 1.0,
      comment: "No validation expectations defined",
    };
  }

  const expectedValid = metadata.expected_valid;
  const wasRejected = report.includes("Unable to process this research question");

  let score = 0;
  let comment = "";

  if (expectedValid && !wasRejected) {
    // Valid question was correctly processed
    score = 1.0;
    comment = "Valid question correctly accepted";
  } else if (!expectedValid && wasRejected) {
    // Invalid question was correctly rejected
    score = 1.0;
    
    // Bonus: Check if helpful suggestion was provided
    const hasSuggestion = report.includes("Suggestion:");
    const hasReason = report.includes("Reason:");
    
    if (hasSuggestion && hasReason) {
      comment = "Invalid question correctly rejected with reason and suggestion";
    } else if (hasReason) {
      score = 0.9;
      comment = "Invalid question correctly rejected with reason (missing suggestion)";
    } else {
      score = 0.7;
      comment = "Invalid question correctly rejected (missing details)";
    }
  } else if (expectedValid && wasRejected) {
    // Valid question was incorrectly rejected (false positive)
    score = 0.0;
    comment = "❌ ERROR: Valid question was incorrectly rejected";
  } else {
    // Invalid question was incorrectly accepted (false negative)
    score = 0.0;
    comment = "❌ ERROR: Invalid question was incorrectly accepted";
  }

  return {
    key: "validation_quality",
    score,
    comment,
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

    const datasetPath = path.join(__dirname, "./datasets/research-questions.jsonl");
    
    // Read JSONL format (each line is a separate JSON object)
    const fileContent = fs.readFileSync(datasetPath, "utf-8");
    const rawData = fileContent
      .trim()
      .split('\n')
      .map(line => JSON.parse(line));

    // Map from JSONL format to LangSmith format
    const inputs = rawData.map((item: any) => ({ 
      question: item.question 
    }));
    
    const outputs = rawData.map((item: any) => ({
      expected_answer: item.expected_answer,
      metadata: item.metadata
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
  console.log("2. Apply evaluators (correctness, citations, completeness, performance, validation)");
  console.log("3. Upload results to LangSmith");
  console.log("\nThis may take a few minutes...\n");

  const results = await evaluate(target, {
    data: "c8a06ee6-9b1e-4c39-82df-fffd67be0b60", // DATASET ID IS HARDCODED
    evaluators: [
      validationEvaluator,    // Run this first to properly categorize questions
      correctnessEvaluator,
      citationEvaluator,
      completenessEvaluator,
      performanceEvaluator,
    ],
    experimentPrefix: "research-agent-eval",
    maxConcurrency: 2,
    metadata: {
      version: "2.0",
      description: "Evaluation of research agent with validation node",
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
  console.log("3. Check validation quality for invalid questions");
  console.log("4. Identify failure patterns");
  console.log("5. Iterate on agent design or prompts");
  console.log("6. Re-run evaluation to measure improvements\n");

  return results;
}

// ALWAYS RUN - Remove the conditional check entirely
runEvaluation().catch((error) => {
  console.error("❌ Evaluation failed:", error);
  process.exit(1);
});

export { runEvaluation };