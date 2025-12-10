import { StateGraph, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage } from "langchain";
import { tools } from "./tools.js";
import {
  generateQueryOrRespond,
  gradeDocuments,
  rewrite,
  generate,
} from "./nodes.js";
import { StateAnnotation } from "./state.js";

// Create a ToolNode for the retriever
const toolNode = new ToolNode(tools);

// Helper function to determine if we should retrieve
function shouldRetrieve(state: { messages: any }) {
  const { messages } = state;
  const lastMessage = messages.at(-1);

  if (AIMessage.isInstance(lastMessage) && lastMessage.tool_calls.length) {
    return "retrieve";
  }
  return END;
}

// Define the graph
const builder = new StateGraph(StateAnnotation)
  .addNode("generateQueryOrRespond", generateQueryOrRespond)
  .addNode("retrieve", toolNode)
  .addNode("gradeDocuments", gradeDocuments)
  .addNode("rewrite", rewrite)
  .addNode("generate", generate)
  // Add edges
  .addEdge(START, "generateQueryOrRespond")
  // Decide whether to retrieve
  .addConditionalEdges("generateQueryOrRespond", shouldRetrieve)
  .addEdge("retrieve", "gradeDocuments")
  // Edges taken after grading documents
  .addConditionalEdges(
    "gradeDocuments",
    // Route based on grading decision
    (state) => {
      // The gradeDocuments function returns either "generate" or "rewrite"
      const lastMessage = state.messages.at(-1);
      return lastMessage.content === "generate" ? "generate" : "rewrite";
    }
  )
  .addEdge("generate", END)
  .addEdge("rewrite", "generateQueryOrRespond");

// Compile
const graph = builder.compile();


export { graph };
