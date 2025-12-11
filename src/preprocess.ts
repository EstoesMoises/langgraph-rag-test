import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";

const urls = [
  "https://docs.langchain.com/oss/javascript/langgraph/install",
  "https://docs.langchain.com/oss/javascript/langgraph/quickstart",
  "https://docs.langchain.com/oss/javascript/langgraph/local-server",
  "https://docs.langchain.com/oss/javascript/langgraph/thinking-in-langgraph",
  "https://docs.langchain.com/oss/javascript/langgraph/workflows-agents",
];

const docs = await Promise.all(
  urls.map((url) => new CheerioWebBaseLoader(url).load()),
);

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const docsList = docs.flat();

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 50,
});
const docSplits = await textSplitter.splitDocuments(docsList);

export { docSplits }