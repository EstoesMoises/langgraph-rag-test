import { createRetrieverTool } from "@langchain/classic/tools/retriever";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { docSplits } from './preprocess.js'

// Document retriever

const vectorStore = await MemoryVectorStore.fromDocuments(
  docSplits,
  new OpenAIEmbeddings(),
);

const retriever = vectorStore.asRetriever();

// Actual tool

const tool: Awaited<ReturnType<typeof createRetrieverTool>> = createRetrieverTool(
  retriever,
  {
    name: "retrieve_langchain_docs",
    description:
      "Search and return information about LangChain documentation on getting started with LangGraph.",
  },
);
const tools: typeof tool[] = [tool];

export { tools }