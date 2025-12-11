import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { type ResearchStateType } from "./state.js";
import { tavily } from "@tavily/core";

/**
 * Node implementations for our research agent.
 * 
 * In LangGraph, nodes are functions that:
 * 1. Receive the current state
 * 2. Perform some operation (LLM call, API request, computation)
 * 3. Return partial state updates
 * 
 * The framework automatically merges these updates back into the state.
 */

const model = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.7,
});

/**
 * PLAN NODE
 * Analyzes the research question and creates a strategic plan.
 * Generates multiple search queries to comprehensively answer the question.
 */
export async function planNode(state: ResearchStateType): Promise<Partial<ResearchStateType>> {
  console.log("\n🧠 Planning research strategy...");
  
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", `You are a research planner. Given a research question, create a strategic plan.
Generate 2-4 specific search queries that will help comprehensively answer the question.
Consider different angles and aspects of the question.

Return your response in this exact JSON format:
{{
  "reasoning": "Brief explanation of your approach",
  "queries": ["query 1", "query 2", "query 3"]
}}`],
    ["human", "Research question: {question}"],
  ]);

  const chain = prompt.pipe(model);
  const response = await chain.invoke({ question: state.question });
  
  // Parse the LLM response
  const content = response.content as string;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    throw new Error("Failed to parse plan from LLM response");
  }
  
  const plan = JSON.parse(jsonMatch[0]);
  
  console.log(`📋 Plan: ${plan.reasoning}`);
  console.log(`🔍 Search queries: ${plan.queries.join(", ")}`);
  
  return {
    plan,
    metadata: {
      steps: ["plan"],
      startTime: state.metadata.startTime,
    },
  };
}

/**
 * SEARCH NODE
 * Executes web searches using Tavily API based on the plan.
 * Collects and structures search results for synthesis.
 */
export async function searchNode(state: ResearchStateType): Promise<Partial<ResearchStateType>> {
  console.log("\n🌐 Executing web searches...");
  
  if (!state.plan || state.plan.queries.length === 0) {
    throw new Error("No search queries in plan");
  }

  // Create Tavily client using the function syntax (not a class)
  if (!process.env.TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY environment variable is not set");
  }
  const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY });
  const allResults = [];

  // Execute each search query
  for (const query of state.plan.queries) {
    console.log(`  Searching: "${query}"`);
    
    try {
      const response = await tavilyClient.search(query, {
        searchDepth: "basic",
        maxResults: 3,
      });

      if (response.results) {
        const formattedResults = response.results.map((r: any) => ({
          title: r.title || "No title",
          url: r.url || "",
          content: r.content || "",
          score: r.score || 0.5,
        }));
        
        allResults.push(...formattedResults);
        console.log(`    ✓ Found ${formattedResults.length} results`);
      }
    } catch (error) {
      console.warn(`    ⚠️  Search failed for "${query}":`, error);
      // Continue with other queries even if one fails
    }
  }

  console.log(`📚 Total results collected: ${allResults.length}`);

  return {
    searchResults: allResults,
    metadata: {
      steps: ["search"],
      startTime: state.metadata.startTime,
    },
  };
}

/**
 * SYNTHESIZE NODE
 * Combines search results into a coherent, well-cited research report.
 * This is the final output node that produces the deliverable.
 */
export async function synthesizeNode(state: ResearchStateType): Promise<Partial<ResearchStateType>> {
  console.log("\n✍️  Synthesizing research report...");

  if (state.searchResults.length === 0) {
    return {
      report: "Unable to generate report: no search results were found.",
      metadata: {
        steps: ["synthesize"],
        startTime: state.metadata.startTime,
        endTime: Date.now(),
      },
    };
  }

  // Prepare search results for the prompt
  const resultsText = state.searchResults
    .map((r, idx) => `[${idx + 1}] ${r.title}\nURL: ${r.url}\nContent: ${r.content}\n`)
    .join("\n");

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", `You are a research synthesizer. Given a research question and web search results,
create a comprehensive, well-structured report.

Requirements:
- Write in clear, professional prose
- Cite sources using [1], [2] format matching the result numbers
- Cover multiple perspectives if relevant
- Be factual and objective
- Include a brief conclusion
- Length: 200-400 words`],
    ["human", `Research Question: {question}

Search Results:
{results}

Write a comprehensive research report:`],
  ]);

  const chain = prompt.pipe(model);
  const response = await chain.invoke({
    question: state.question,
    results: resultsText,
  });

  const report = response.content as string;
  
  console.log(`✅ Report generated (${report.length} characters)`);

  return {
    report,
    metadata: {
      steps: ["synthesize"],
      startTime: state.metadata.startTime,
      endTime: Date.now(),
    },
  };
}