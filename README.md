# Research Agent with LangGraph

A production-ready research agent built with LangGraph that intelligently validates questions, searches the web, and synthesizes comprehensive research reports with proper citations.

## 🌟 Features

- **Question Validation**: Automatically validates research questions before processing
- **Strategic Planning**: Creates targeted search queries to comprehensively answer questions
- **Web Search**: Executes searches using Tavily API with intelligent query generation
- **Smart Synthesis**: Combines multiple sources into coherent reports with citations
- **Comprehensive Evaluation**: Built-in LangSmith evaluation framework with 5 quality metrics
- **Type-Safe State**: Leverages LangGraph's Annotation API for robust state management

## 🏗️ Architecture

### Graph Flow

```
START → Validate → [Valid?] → Plan → Search → Synthesize → END
                      ↓
                    [Invalid] → END (with suggestions)
```

<img width="817" height="763" alt="Screenshot 2025-12-11 123303" src="https://github.com/user-attachments/assets/fe085b7b-32b8-4001-8811-090c7591e8e3" />


### Key Components

1. **State Management** (`state.ts`)
   - Type-safe state definition using LangGraph Annotations
   - Tracks question, validation status, plan, search results, and report
   - Custom reducers for array concatenation and metadata merging

2. **Node Implementations** (`nodes.ts`)
   - `validateQuestionNode`: Checks if questions are valid and answerable
   - `planNode`: Generates 2-4 strategic search queries
   - `searchNode`: Executes searches via Tavily API
   - `synthesizeNode`: Creates final report with citations

3. **Graph Definition** (`agent.ts`)
   - Conditional routing based on validation results
   - Linear flow for valid questions: validate → plan → search → synthesize
   - Early termination for invalid questions with helpful feedback

## 📦 Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
```

### Required Environment Variables

```env
OPENAI_API_KEY=your_openai_key
TAVILY_API_KEY=your_tavily_key
LANGSMITH_API_KEY=your_langsmith_key  # Optional, for evaluation
```

## 🚀 Usage

### Basic Research

```bash
# Run with default question
pnpm test

# Run with custom question
pnpm test "What are the latest developments in quantum computing?"
```

### LangGraph Server

```bash
# Start development server with LangGraph Studio
pnpm server
```
If that doesn't work, use ``npx @langchain/langgraph-cli dev`` directly.


Then open LangGraph Studio to visualize and interact with your agent.

## 🧪 Evaluation

The project includes a comprehensive evaluation suite with 5 evaluators:

### Evaluators

1. **Validation Quality**
   - Checks if invalid questions are correctly rejected
   - Verifies helpful suggestions are provided
   - Ensures valid questions are accepted

2. **Correctness**
   - Uses LLM-as-Judge to assess factual accuracy
   - Compares output against expected answers

3. **Citation Quality**
   - Counts citations in report
   - Verifies citation format `[1]`, `[2]`, etc.
   - Checks alignment with search results

4. **Completeness**
   - Validates presence of expected key terms
   - Ensures comprehensive coverage of topic

5. **Performance**
   - Measures execution time
   - Tracks number of sources collected
   - Penalizes slow runs or insufficient sources

### Running Evaluations

```bash
# Run full evaluation suite
pnpm evaluate
```

### Dataset Setup

The evaluation system automatically creates and manages datasets in LangSmith using the SDK.

**Configure Dataset Name:**

In `src/evaluations/langsmith.ts`, set your desired dataset name:

```typescript
const DATASET_NAME = "research_dataset" // Change this to your preferred name
```

**How it works:**
- On first run, the evaluation creates a new dataset in LangSmith with your chosen name
- It reads test cases from `src/evaluations/datasets/research-questions.jsonl`
- Subsequent runs reuse the existing dataset (no duplicates created)
- You can view and manage the dataset in the LangSmith UI

**Dataset Format (JSONL):**

Test cases are stored in `src/evaluations/datasets/research-questions.jsonl`:

```jsonl
{"question": "What is photosynthesis?", "expected_answer": "...", "metadata": {"should_include": ["chlorophyll", "sunlight"], "expected_valid": true}}
{"question": "asdfghjkl", "expected_answer": "", "metadata": {"expected_valid": false}}
```

Each line is a JSON object with:
- `question`: The research question to test
- `expected_answer`: Expected response for correctness evaluation
- `metadata`: Additional validation criteria
  - `should_include`: Array of terms that should appear in the report
  - `expected_valid`: Whether the question should be accepted (true) or rejected (false)

## 📊 Example Output

### Valid Question

```
🚀 Starting research agent...
❓ Question: What are the latest developments in AI safety research?

🔍 Validating research question...
✅ Question validated: Clear research question about current developments

🧠 Planning research strategy...
📋 Plan: Search for recent AI safety developments and research initiatives
🔍 Search queries: AI safety research 2024, AI alignment techniques, AI safety organizations

🌐 Executing web searches...
  Searching: "AI safety research 2024"
    ✓ Found 3 results
  ...
📚 Total results collected: 9

✍️ Synthesizing research report...
✅ Report generated (1247 characters)

================================================================================
📊 RESEARCH REPORT
================================================================================

Recent developments in AI safety research have focused on alignment techniques...
[1] OpenAI has released new frameworks for constitutional AI...
[2] Anthropic's research on mechanistic interpretability...
...
```

### Invalid Question

```
❌ Question rejected: Too vague or unclear to research effectively
💡 Suggestion: Try rephrasing with more specific aspects or context

================================================================================
📊 RESEARCH REPORT
================================================================================

Unable to process this research question.

Reason: Question is too vague or ambiguous to research effectively
Suggestion: Please provide more specific details about what aspect you'd like to research
```

---

**Built with**: LangGraph 🦜🔗 | TypeScript | OpenAI | Tavily