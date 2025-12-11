import { Annotation } from "@langchain/langgraph";

/**
 * ResearchState defines the shape of data flowing through our LangGraph agent.
 * 
 * This is a core LangGraph concept - the state is passed between nodes,
 * and each node can read from and update parts of it.
 */

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface ResearchPlan {
  queries: string[];
  reasoning: string;
}

/**
 * Using LangGraph's Annotation API for type-safe state management.
 * Each field can optionally specify a reducer function for how updates are merged.
 */
export const ResearchState = Annotation.Root({
  // Input: The research question to investigate
  question: Annotation<string>,
  
  // Validation: Whether the question is valid for research
  isValidQuestion: Annotation<boolean>({
    default: () => true,
    reducer: (_, update) => update ?? true,
  }),
  
  // Plan: Generated research plan with search queries
  plan: Annotation<ResearchPlan | null>({
    default: () => null,
    reducer: (_, update) => update,
  }),
  
  // Search Results: Raw results from web searches
  searchResults: Annotation<SearchResult[]>({
    default: () => [],
    // Reducer: append new results to existing array
    reducer: (current, update) => [...current, ...update],
  }),
  
  // Report: Final synthesized research report
  report: Annotation<string | null>({
    default: () => null,
    reducer: (_, update) => update,
  }),
  
  // Metadata: Track steps and timing for evaluation
  metadata: Annotation<{
    steps: string[];
    startTime: number;
    endTime?: number;
  }>({
    default: () => ({
      steps: [],
      startTime: Date.now(),
    }),
    reducer: (current, update) => ({
      ...current,
      ...update,
      steps: [...current.steps, ...(update.steps || [])],
    }),
  }),
});

export type ResearchStateType = typeof ResearchState.State;