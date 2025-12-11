import { StateGraph, END, START } from "@langchain/langgraph";
import { ResearchState } from "./state.js";
import { planNode, searchNode, synthesizeNode } from "./nodes.js";

/**
 * Main Research Agent Graph
 * 
 * This is where we define the LangGraph workflow structure:
 * - Nodes: Individual functions that process state
 * - Edges: Connections defining the flow between nodes
 * - Entry/Exit points: START and END
 * 
 * The graph is compiled into a runnable that manages state transitions.
 */

export function createResearchAgent() {
  // Initialize the graph with our state schema
  const workflow = new StateGraph(ResearchState);

  // Add nodes to the graph
  // Each node is a processing step in our research pipeline
workflow.addNode("planning", planNode);
workflow.addNode("searching", searchNode);
workflow.addNode("synthesizing", synthesizeNode);

workflow.addEdge(START, "planning");
workflow.addEdge("planning", "searching");
workflow.addEdge("searching", "synthesizing");
workflow.addEdge("synthesizing", END);

  // Compile the graph into an executable
  const app = workflow.compile();

  return app;
}

/**
 * Helper function to run the agent with a research question
 */
export async function runResearch(question: string) {
  const agent = createResearchAgent();
  
  console.log("🚀 Starting research agent...");
  console.log(`❓ Question: ${question}\n`);
  
  // Invoke the agent with initial state
  const result = await agent.invoke({
    question,
  });

  return result;
}

export const graph = createResearchAgent();

/**
 * DESIGN NOTES FOR EVALUATION:
 * 
 * Current graph design is intentionally simple (linear flow).
 * Potential improvements to test in evaluation:
 * 
 * 1. Conditional edges:
 *    - Check if search results are sufficient before synthesizing
 *    - Loop back to plan/search if results are poor
 * 
 * 2. Parallel execution:
 *    - Run multiple searches concurrently
 *    - Use LangGraph's parallelization features
 * 
 * 3. Quality gates:
 *    - Add a validation node after search
 *    - Conditionally branch based on result quality
 * 
 * 4. Human-in-the-loop:
 *    - Add interrupt points for review
 *    - Allow manual query refinement
 * 
 * 5. Error handling:
 *    - Graceful degradation if searches fail
 *    - Retry logic for failed API calls
 */