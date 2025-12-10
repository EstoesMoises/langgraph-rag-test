import { HumanMessage } from "@langchain/core/messages";
import { StateAnnotation } from "./state.js";
import { graph } from "./graph.js";

const inputs = {
  messages: [
    new HumanMessage(
      "What does Lilian Weng say about types of reward hacking?"
    ),
  ],
};

for await (const output of await graph.stream(inputs)) {
  for (const [key, value] of Object.entries(output)) {
    const lastMsg = output[key].messages[output[key].messages.length - 1];
    console.log(`Output from node: '${key}'`);
    console.log({
      type: lastMsg._getType(),
      content: lastMsg.content,
      tool_calls: lastMsg.tool_calls,
    });
    console.log("---\n");
  }
}
