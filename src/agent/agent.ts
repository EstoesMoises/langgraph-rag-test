import { StateGraph, END, START } from "@langchain/langgraph";
import { ResearchState } from "./state.js";
import { planNode, searchNode, synthesizeNode, validateQuestionNode } from "./nodes.js";

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

/**
 * Router function to determine if question is valid
 */
function routeAfterValidation(state: typeof ResearchState.State) {
  if (state.isValidQuestion === false) {
    return "reject"; // Go to rejection/clarification path
  }
  return "planning"; // Proceed with research
}

export function createResearchAgent() {
  // Initialize the graph with our state schema
  const workflow = new StateGraph(ResearchState);

  // Add nodes to the graph
  workflow.addNode("validate", validateQuestionNode);
  workflow.addNode("planning", planNode);
  workflow.addNode("searching", searchNode);
  workflow.addNode("synthesizing", synthesizeNode);

  // Define the flow
  workflow.addEdge(START, "validate");
  
  // Conditional edge based on validation
  workflow.addConditionalEdges(
    "validate",
    routeAfterValidation,
    {
      planning: "planning",
      reject: END, // End if question is invalid
    }
  );
  
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