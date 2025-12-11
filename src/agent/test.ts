import * as dotenv from "dotenv";
import { runResearch } from "./agent.js";

// Load environment variables
dotenv.config();

/**
 * Manual execution script for testing the agent
 * Usage: pnpm test "Your research question here"
 */

async function main() {
  // Get question from command line or use default
  const question = process.argv[2] || "What are the latest developments in AI safety research?";

  try {
    const result = await runResearch(question);

    console.log("\n" + "=".repeat(80));
    console.log("📊 RESEARCH REPORT");
    console.log("=".repeat(80) + "\n");
    console.log(result.report);
    console.log("\n" + "=".repeat(80));
    console.log("🔗 SOURCES");
    console.log("=".repeat(80) + "\n");
    
    result.searchResults.forEach((source, idx) => {
      console.log(`[${idx + 1}] ${source.title}`);
      console.log(`    ${source.url}\n`);
    });

    console.log("=".repeat(80));
    console.log("⏱️  METADATA");
    console.log("=".repeat(80) + "\n");
    console.log(`Steps: ${result.metadata.steps.join(" → ")}`);
    console.log(`Duration: ${((result.metadata.endTime! - result.metadata.startTime) / 1000).toFixed(2)}s`);
    console.log(`Sources collected: ${result.searchResults.length}`);

  } catch (error) {
    console.error("❌ Error running research agent:", error);
    process.exit(1);
  }
}

main();