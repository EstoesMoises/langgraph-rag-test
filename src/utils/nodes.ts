import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { AIMessage } from "@langchain/core/messages";
import { tools } from "./tools.js";
import * as z from "zod";
import "dotenv/config"

// Node 1: Generate query or respond with tool calls
async function generateQueryOrRespond(state: { messages: any }) {
  const { messages } = state;
  const model = new ChatOpenAI({
    model: "gpt-4o",
    temperature: 0,
  }).bindTools(tools);

  const response = await model.invoke(messages);
  return {
    messages: [response],
  };
}

// Node 2: Rewrite the question
async function rewrite(state: { messages: any }) {
  const { messages } = state;
  const question = messages.at(0)?.content;

  const rewritePrompt = ChatPromptTemplate.fromTemplate(
    `Look at the input and try to reason about the underlying semantic intent / meaning. \n
    Here is the initial question:
    \n ------- \n
    {question}
    \n ------- \n
    Formulate an improved question:`
  );

  const model = new ChatOpenAI({
    model: "gpt-4o",
    temperature: 0,
  });

  const response = await rewritePrompt.pipe(model).invoke({ question });
  return {
    messages: [response],
  };
}

// Node 3: Generate final answer
async function generate(state: { messages: any }) {
  const { messages } = state;
  const question = messages.at(0)?.content;
  const context = messages.at(-1)?.content;

  const prompt = ChatPromptTemplate.fromTemplate(
    `You are an assistant for question-answering tasks.
    Use the following pieces of retrieved context to answer the question.
    If you don't know the answer, just say that you don't know.
    Use three sentences maximum and keep the answer concise.
    Question: {question}
    Context: {context}`
  );

  const llm = new ChatOpenAI({
    model: "gpt-4o",
    temperature: 0,
  });

  const ragChain = prompt.pipe(llm);

  const response = await ragChain.invoke({
    context,
    question,
  });

  return {
    messages: [response],
  };
}

// Node 4: Grade documents (conditional edge logic)
const gradeDocumentsSchema = z.object({
  binaryScore: z.string().describe("Relevance score 'yes' or 'no'"),
});

async function gradeDocuments(state: { messages: any }) {
  const { messages } = state;

  const prompt = ChatPromptTemplate.fromTemplate(
    `You are a grader assessing relevance of retrieved docs to a user question.
    Here are the retrieved docs:
    \n ------- \n
    {context}
    \n ------- \n
    Here is the user question: {question}
    If the content of the docs are relevant to the users question, score them as relevant.
    Give a binary score 'yes' or 'no' score to indicate whether the docs are relevant to the question.
    Yes: The docs are relevant to the question.
    No: The docs are not relevant to the question.`
  );

  const model = new ChatOpenAI({
    model: "gpt-4o",
    temperature: 0,
  }).withStructuredOutput(gradeDocumentsSchema);

  const score = await prompt.pipe(model).invoke({
    question: messages.at(0)?.content,
    context: messages.at(-1)?.content,
  });

  // Return a state update with the grading decision
  return {
    messages: [new AIMessage(score.binaryScore === "yes" ? "generate" : "rewrite")],
  };
}

export { generateQueryOrRespond, rewrite, generate, gradeDocuments };