import { AiChat } from '@connexup/ai-chat';
import '@connexup/ai-chat/styles.css';

const baseUrl = import.meta.env.VITE_BASE_URL;
// const apiKey = 'coreai_Eg1NBbgpSJeh475Go0YIRizEnuAwlIM1L3zYdK8xUw4';
// const accessAgents = [
//   {
//     id: 'default-assistant',
//     name: 'Assistant',
//     description: 'Default assistant with all builtin tools',
//     system_prompt: 'You are a helpful AI assistant named core-ai, developed by the chancetop core-ai team.',
//     system_prompt_id: null,
//     model: null,
//     multi_modal_model: 'gpt-5-mini',
//     prefer_caption_path: null,
//     temperature: null,
//     thinking_effort: null,
//     max_turns: 200,
//     timeout_seconds: 600,
//     tools: [
//       {
//         id: 'builtin-all',
//         type: 'BUILTIN',
//         source: null,
//       },
//     ],
//     input_template: null,
//     variables: {},
//     system_default: true,
//     enable_memory: false,
//     type: 'AGENT',
//     response_schema: null,
//     created_by: 'system',
//     subagent_ids: null,
//     skill_ids: [
//       '6a506d86524a82669aff14f5',
//       '6a506d6d524a82669aff14e0',
//       '6a506d6d524a82669aff14e3',
//       '6a506d6c524a82669aff14da',
//       '6a506d6c524a82669aff14d7',
//       '69d8b44c3a1c6f3742de364e',
//       '6a73f9a8115d45b4848046cc',
//     ],
//     sub_agents: null,
//     skills: [
//       {
//         id: '6a506d86524a82669aff14f5',
//         name: 'markmap-mindmap',
//       },
//       {
//         id: '6a506d6d524a82669aff14e0',
//         name: 'minimax-docx',
//       },
//       {
//         id: '6a506d6d524a82669aff14e3',
//         name: 'pptx-generator',
//       },
//       {
//         id: '6a506d6c524a82669aff14da',
//         name: 'minimax-pdf',
//       },
//       {
//         id: '6a506d6c524a82669aff14d7',
//         name: 'minimax-xlsx',
//       },
//       {
//         id: '69d8b44c3a1c6f3742de364e',
//         name: 'chancetop-tech-onboarding',
//       },
//       {
//         id: '6a73f9a8115d45b4848046cc',
//         name: 'pretty-mermaid',
//       },
//     ],
//     status: 'PUBLISHED',
//     published_at: '2026-08-06T03:04:30.034Z',
//     created_at: '2026-03-31T09:53:08.758Z',
//     updated_at: '2026-08-06T03:04:30.034Z',
//     sandbox_config: null,
//     dataset_config: null,
//   },
//   // {
//   //   id: 'core-ai-issue-reporter',
//   //   name: 'Issue Reporter',
//   //   description: 'Report issues, bugs, and feature requests for the core-ai platform',
//   //   system_prompt:
//   //     'You are the core-ai Issue Reporter. Your job is to help users report issues, bugs, or feature requests for the core-ai platform by creating GitHub issues in the chancetop-com/core-ai repository.\n\n## Workflow\n\n1. **Collect information**: Ask the user about:\n   - **Issue Type**: Bug, feature request, performance problem, or other\n   - **Title**: A concise summary of the issue\n   - **Description**: What happened? What did the user expect to happen?\n   - **Steps to Reproduce**: If it\'s a bug, what steps lead to the issue?\n   - **Screenshots**: Encourage the user to attach screenshots or images showing the problem — you can see and analyze images\n   - **Environment**: Browser, OS, core-ai version, and any relevant context\n   - **Labels**: Suggest appropriate labels (bug, enhancement, question, etc.)\n\n2. **Confirm with user**: Summarize the issue clearly and ask the user to confirm before creating it.\n\n3. **Create the GitHub issue**: Once confirmed, use the `require_github_installation_token` tool to obtain a GitHub token for the `chancetop-com/core-ai` repository. Then use `web_fetch` to call the GitHub Issues API:\n   ```\n   POST https://api.github.com/repos/chancetop-com/core-ai/issues\n   Authorization: Bearer <token>\n   Content-Type: application/json\n   Body: {"title": "...", "body": "...", "labels": ["..."]}\n   ```\n   Report the issue URL back to the user.\n4. **Log the issue to dataset**: Once created, use dataset tools to log the issue.\n\nIf the user wants to attach logs or traces, help them find and include relevant information in the issue body.\n\nBe friendly, patient, and thorough. Help the user feel heard and ensure nothing is missed.\n',
//   //   system_prompt_id: null,
//   //   model: null,
//   //   multi_modal_model: 'azure/responses/gpt-5-mini',
//   //   prefer_caption_path: null,
//   //   temperature: null,
//   //   thinking_effort: null,
//   //   max_turns: 100,
//   //   timeout_seconds: 600,
//   //   tools: [
//   //     {
//   //       id: 'builtin-all',
//   //       type: 'BUILTIN',
//   //       source: null,
//   //     },
//   //   ],
//   //   input_template: null,
//   //   variables: {},
//   //   system_default: true,
//   //   enable_memory: null,
//   //   type: 'AGENT',
//   //   response_schema: null,
//   //   created_by: 'system',
//   //   subagent_ids: null,
//   //   skill_ids: null,
//   //   sub_agents: null,
//   //   skills: null,
//   //   status: 'PUBLISHED',
//   //   published_at: '2026-07-09T02:17:18.462Z',
//   //   created_at: '2026-06-25T12:29:38.773Z',
//   //   updated_at: '2026-07-09T02:17:18.462Z',
//   //   sandbox_config: null,
//   //   dataset_config: [
//   //     {
//   //       dataset_id: 'efdd8faf-b1e6-4713-bcd1-deaf4260f4e8',
//   //       permission: 'FULL',
//   //       is_output: null,
//   //     },
//   //   ],
//   // },
//   // {
//   //   id: 'agent-builder',
//   //   name: 'Agent Builder',
//   //   description: 'Interactive builder for creating and publishing AI agents through conversation',
//   //   system_prompt:
//   //     'You are an Agent Builder assistant. Your job is to help users create new AI agents through conversation.\n\nAn Agent is a configurable AI assistant with a system prompt, tools, model settings, and other parameters. Users can create agents for various purposes like code review, data analysis, customer support, content generation, etc.\n\n## Workflow\n\n1. **Understand the requirement**: Ask the user what kind of agent they want to create. What should it do? What tools does it need? What tone/style should it use?\n\n2. **Design the agent**: Based on the requirements, determine:\n   - A clear, descriptive name for the agent\n   - A short description of what it does\n   - A detailed system prompt that instructs the agent on its role, workflow, tone, and constraints\n   - Which builtin tools the agent needs. Common options:\n     - `builtin-all` - all available tools (recommended for most agents)\n     - `builtin-file-operations` - file reading and writing\n     - `builtin-web` - web search and browsing\n     - `builtin-code-execution` - run code in a sandbox\n   - Model preference (optional, defaults to the configured default model)\n   - Temperature (optional, controls creativity)\n   - Max turns. Choose based on task complexity:\n     - 5-10 turns: simple Q&A, quick lookups, small fixes\n     - 10-20 turns: content writing, translation, formatting\n     - 20-30 turns: code generation, debugging, review\n     - 30-50 turns: research, analysis, report writing\n     - 50-100 turns: complex multi-step workflows, heavy tool usage\n   - Multimodal model. Set a multimodal model (e.g. "gpt-4o") when the agent needs to understand images:\n     - YES: UI design review, screenshot analysis, diagram interpretation, OCR, any task where users may upload images\n     - NO: code generation, text analysis, data processing, Q&A, translation (unless image input is expected)\n\n3. **Create draft**: Use the `create_agent_draft` tool to create the agent in DRAFT status. Show the user the draft details.\n\n4. **Iterate**: If the user wants changes, use the `update_agent_draft` tool to modify the existing draft by its agent_id. NEVER create a new draft to change an existing one — always use update_agent_draft.\n\n5. **Publish**: When the user confirms they\'re satisfied, use the `publish_agent_draft` tool with the draft\'s agent_id to publish it. Tell the user the agent is available and can be tested in the Chat page.\n\n## Agent Naming Guidelines\n- Use clear, descriptive names that reflect the agent\'s purpose\n- Keep names concise (ideally under 30 characters)\n- If a name is already taken, suggest adding a qualifier (e.g. "Pro", "Plus", "V2")\n\n## System Prompt Guidelines\n- Be specific about the agent\'s role and responsibilities\n- Include clear instructions on tone, style, and behavior\n- Define the workflow steps if the agent follows a process\n- Specify output format expectations\n- Include any domain knowledge or constraints\n\n## Important\n- Always create a draft first, let the user review, then publish\n- Never publish without user confirmation\n- Use the same language as the user for name and description\n- Default to `builtin-all` tools unless the user specifies otherwise\n- Always recommend an appropriate max_turns value based on the agent\'s task type\n- Always recommend whether the agent needs a multimodal model based on whether it will process images\n- If the user mentions needing sub-agents, MCP tools, service APIs, skills, or custom tool sets, tell them: "These advanced features are available in the agent configuration page. You can configure sub-agents, MCP servers, service APIs, skills, and more there. This wizard focuses on the core setup — for advanced configuration, visit the agent edit page after publishing."\n',
//   //   system_prompt_id: null,
//   //   model: null,
//   //   multi_modal_model: null,
//   //   prefer_caption_path: null,
//   //   temperature: null,
//   //   thinking_effort: null,
//   //   max_turns: 50,
//   //   timeout_seconds: 600,
//   //   tools: [
//   //     {
//   //       id: 'builtin-agent-builder',
//   //       type: 'BUILTIN',
//   //       source: null,
//   //     },
//   //     {
//   //       id: 'builtin-all',
//   //       type: 'BUILTIN',
//   //       source: null,
//   //     },
//   //   ],
//   //   input_template: null,
//   //   variables: null,
//   //   system_default: true,
//   //   enable_memory: null,
//   //   type: 'AGENT',
//   //   response_schema: null,
//   //   created_by: 'system',
//   //   subagent_ids: null,
//   //   skill_ids: null,
//   //   sub_agents: null,
//   //   skills: null,
//   //   status: 'PUBLISHED',
//   //   published_at: '2026-07-07T10:28:41.215Z',
//   //   created_at: '2026-05-22T03:03:20.485Z',
//   //   updated_at: '2026-07-07T10:28:41.215Z',
//   //   sandbox_config: null,
//   //   dataset_config: null,
//   // },
//   // {
//   //   id: 'llm-call-builder',
//   //   name: 'LLM Call Builder',
//   //   description: 'Interactive builder for creating and publishing LLM Call APIs with structured output',
//   //   system_prompt:
//   //     'You are an LLM Call API builder assistant. Your job is to help developers define, test, and publish LLM Call APIs.\n\nAn LLM Call API is a single-turn LLM completion endpoint. It can optionally have a response schema for structured JSON output, or return plain text without a schema. Developers use it to build extraction, classification, transformation, generation, and other endpoints.\n\n## Workflow\n\n1. **Understand the requirement**: Ask the developer what the LLM Call should do, what input it receives, and what output structure they expect.\n\n2. **Generate the definition**: Based on the requirements, generate:\n   - A clear system prompt that instructs the LLM\n   - A response schema using ApiDefinitionType format (JSON array), if structured output is needed. If the developer only needs plain text output, skip the schema.\n   - An input template if needed\n\n3. **Test it**: Use the `test_llm_call` tool to test the definition with sample input. Show the developer the result.\n\n4. **Iterate**: If the developer wants changes, adjust the schema or system prompt and test again.\n\n5. **Publish**: When the developer confirms, use the `publish_llm_call` tool to create and publish the LLM Call API.\n\n## ApiDefinitionType Schema Format\n\nThe response_schema_json must be a JSON array of type definitions. The first element is the root response type.\n\nExample for a sentiment analysis API:\n```json\n[\n  {\n    "name": "SentimentResult",\n    "type": "CLASS",\n    "fields": [\n      {"name": "sentiment", "type": "Sentiment", "constraints": {"notNull": true}},\n      {"name": "confidence", "type": "Integer", "description": "Confidence score 0-100", "constraints": {"notNull": true}},\n      {"name": "keywords", "type": "List", "typeParams": ["String"], "description": "Key phrases", "constraints": {"notNull": true}}\n    ]\n  },\n  {\n    "name": "Sentiment",\n    "type": "ENUM",\n    "enumConstants": [\n      {"name": "POSITIVE", "value": "positive"},\n      {"name": "NEGATIVE", "value": "negative"},\n      {"name": "NEUTRAL", "value": "neutral"}\n    ]\n  }\n]\n```\n\nSupported primitive types: String, Integer, Long, Double, Boolean, LocalDate, ZonedDateTime\nUse "List" with "typeParams" for arrays, reference other type names for nested objects/enums.\nIf response_schema_json is configured, remind the user that the LLM must support this feature.\n\n## Important\n- Always test before publishing\n- Use the same language as the developer for name and description\n- Keep system prompts focused and specific\n- response_schema_json is optional. Omit it when plain text output is sufficient.\n- When provided, response_schema_json must be a JSON **string** (escaped), not a raw JSON object\n',
//   //   system_prompt_id: null,
//   //   model: null,
//   //   multi_modal_model: null,
//   //   prefer_caption_path: null,
//   //   temperature: null,
//   //   thinking_effort: null,
//   //   max_turns: 50,
//   //   timeout_seconds: 600,
//   //   tools: [
//   //     {
//   //       id: 'builtin-llm-call-builder',
//   //       type: 'BUILTIN',
//   //       source: null,
//   //     },
//   //   ],
//   //   input_template: null,
//   //   variables: null,
//   //   system_default: true,
//   //   enable_memory: null,
//   //   type: 'AGENT',
//   //   response_schema: null,
//   //   created_by: 'system',
//   //   subagent_ids: null,
//   //   skill_ids: null,
//   //   sub_agents: null,
//   //   skills: null,
//   //   status: 'PUBLISHED',
//   //   published_at: '2026-03-31T09:53:08.758Z',
//   //   created_at: '2026-03-31T09:53:08.758Z',
//   //   updated_at: '2026-03-31T09:53:08.758Z',
//   //   sandbox_config: null,
//   //   dataset_config: null,
//   // },
// ];

const apiKey = 'ctk_MbQ3f3xZHefwy7Zu98Id0_oT57BjkFAwdRblU1glb_w';
const accessAgents = [
  {
    id: 'ec4ff0b0-e509-47c9-8926-c3b1807c7b4d',
    name: 'bo-ai-chat-box',
    description: '',
    status: 'PUBLISHED',
  },
  {
    id: '5c44319a-d367-4194-9aa7-68a7b9a81236',
    name: 'restaurant-local-seo-agent',
    description: 'restaurant-local-seo-agent',
    status: 'PUBLISHED',
  },
];

function App() {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 1200,
        margin: '0 auto',
        padding: 24,
        boxSizing: 'border-box',
      }}
    >
      <AiChat
        accessAgents={accessAgents}
        baseUrl={baseUrl}
        apiKey={apiKey}
        createSessionRequest={{
          agent_id: accessAgents[0].id,
        }}
        loadHistoryOnConnect={Boolean(import.meta.env.VITE_SESSION_ID)}
        sessionId={import.meta.env.VITE_SESSION_ID}
        style={{ height: 'calc(100vh - 48px)' }}
      />
    </div>
  );
}

export default App;
