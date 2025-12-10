
import { ChatOpenAI } from "@langchain/openai";
import { tools } from "./utils/tools.js";
import "dotenv/config"

async function generateQueryOrRespond(state: { messages: any; }) {
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

// TEST HUMAN MESSAGE

import { HumanMessage } from "@langchain/core/messages";

const input = {
  messages: [
    new HumanMessage("What does Lilian Weng say about types of reward hacking?")
  ]
};
const result = await generateQueryOrRespond(input);
console.log(result.messages[0]);