import config from '../../config/config.js';

/**
 * 官方指纹：环境初始化包 1 - user_information
 */
const PACKET_USER_INFO = `<user_information>
The USER's OS version is windows.
The user has 1 active workspaces, each defined by a URI and a CorpusName. Multiple URIs potentially map to the same CorpusName. The mapping is shown as follows in the format [URI] -> [CorpusName]:
c:\\Users\\zhishang\\Desktop\\project\\antiearth -> fuwei99/antiearth
Code relating to the user's requests should be written in the locations listed above. Avoid writing project code files to tmp, in the .gemini dir, or directly to the Desktop and similar folders unless explicitly asked.
</user_information>`;

/**
 * 官方指纹：环境初始化包 2 - artifacts
 */
const PACKET_ARTIFACTS = `<artifacts>
Artifact Directory Path: C:\\Users\\zhishang\\.gemini\\antigravity\\brain\\f154bde8-4fa7-425e-9299-c428c9dfbdb3
</artifacts>`;

/**
 * 官方指纹：环境初始化包 3 - user_rules
 * 根据需求，此部分留空
 */
const PACKET_USER_RULES = `<user_rules>
</user_rules>`;

/**
 * 官方指纹：环境初始化包 4 - workflows
 */
const PACKET_WORKFLOWS = `<workflows>
You have the ability to use and create workflows, which are well-defined steps on how to achieve a particular thing. These workflows are defined as .md files in {.agents,.agent,_agents,_agent}/workflows.
The workflow files follow the following YAML frontmatter + markdown format:
---
description: [short title, e.g. how to deploy the application]
---
[specific steps on how to run this workflow]

 - You might be asked to create a new workflow. If so, create a new file in {.agents,.agent,_agents,_agent}/workflows/[filename].md (use absolute path) following the format described above. Be very specific with your instructions.
 - If a workflow step has a '// turbo' annotation above it, you can auto-run the workflow step if it involves the run_command tool, by setting 'SafeToAutoRun' to true. This annotation ONLY applies for this single step.
   - For example if a workflow includes:
\`\`\`
2. Make a folder called foo
// turbo
3. Make a folder called bar
\`\`\`
You should auto-run step 3, but use your usual judgement for step 2.
 - If a workflow has a '// turbo-all' annotation anywhere, you MUST auto-run EVERY step that involves the run_command tool, by setting 'SafeToAutoRun' to true. This annotation applies to EVERY step.
 - If a workflow looks relevant, or the user explicitly uses a slash command like /slash-command, then use the view_file tool to read {.agents,.agent,_agents,_agent}/workflows/slash-command.md.

</workflows>`;

/**
 * 将消息数组扁平化为带标签的文本格式
 * 优化：System 直接顶格写无前缀，User -> Human，Model -> Assistant
 */
export function flattenHistory(messages) {
  let flattened = '';
  for (const msg of messages) {
    const content = msg.parts.map(p => p.text || '').join('\n');
    
    if (msg.role === 'system') {
      flattened += `${content}\n\n`;
      continue;
    }

    let roleName = '';
    switch (msg.role) {
      case 'user':
        roleName = 'Human';
        break;
      case 'assistant':
      case 'model':
        roleName = 'Assistant';
        break;
      default:
        roleName = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
    }

    flattened += `${roleName}: ${content}\n\n`;
  }
  return flattened.trim();
}

/**
 * 组装 6 条消息的官方复合结构
 */
export function wrapOfficialProtocol(messages, systemInstruction) {
  let systemText = '';
  if (systemInstruction && systemInstruction.parts) {
    systemText = systemInstruction.parts.map(p => p.text || '').join('\n');
  } else if (typeof systemInstruction === 'string') {
    systemText = systemInstruction;
  }

  const flattenedText = flattenHistory(messages);
  
  // 将系统提示词与对话历史合并，系统提示词置顶且顶格
  const combinedText = systemText 
    ? `${systemText}\n\n${flattenedText}`.trim()
    : flattenedText;

  const currentTime = new Date().toISOString();

  // 构建第 5 条消息 (USER_REQUEST)
  const userRequestText = `Step Id: 0

<USER_REQUEST>
${combinedText}
</USER_REQUEST>

<ADDITIONAL_METADATA>
The current local time is: ${currentTime}. This is the latest source of truth for time; do not attempt to get the time any other way.

The user's current state is as follows:
No browser pages are currently open.
</ADDITIONAL_METADATA>`;

  // 构建第 6 条消息 (Conversation History Summary)
  const historySummaryText = `Step Id: 1
# Conversation History
Here are the conversation IDs, titles, and summaries of your most recent 1 conversations, in reverse chronological order:

<conversation_summaries>
## Conversation 03f96958-9f08-4729-96bd-4f7f951fb62c: Antigravity Context
- Created: ${currentTime}
- Last modified: ${currentTime}

### USER Objective:
无
</conversation_summaries>`;

  return [
    { role: 'user', parts: [{ text: PACKET_USER_INFO }] },
    { role: 'user', parts: [{ text: PACKET_ARTIFACTS }] },
    { role: 'user', parts: [{ text: PACKET_USER_RULES }] },
    { role: 'user', parts: [{ text: PACKET_WORKFLOWS }] },
    { role: 'user', parts: [{ text: userRequestText }] },
    { role: 'user', parts: [{ text: historySummaryText }] }
  ];
}

/**
 * 官方完整工具声明列表 (根据抓包提取核心框架)
 */
export function getOfficialTools() {
  return [
    {
      functionDeclarations: [
        {
          name: "browser_subagent",
          description: "Start a browser subagent to perform actions in the browser...",
          parameters: {
            type: "OBJECT",
            properties: {
              TaskName: { type: "STRING" },
              Task: { type: "STRING" },
              TaskSummary: { type: "STRING" },
              RecordingName: { type: "STRING" }
            },
            required: ["TaskName", "Task", "TaskSummary", "RecordingName"]
          }
        },
        {
          name: "run_command",
          description: "PROPOSE a command to run on behalf of the user...",
          parameters: {
            type: "OBJECT",
            properties: {
              CommandLine: { type: "STRING" },
              Cwd: { type: "STRING" },
              SafeToAutoRun: { type: "BOOLEAN" },
              WaitMsBeforeAsync: { type: "INTEGER" }
            },
            required: ["Cwd", "WaitMsBeforeAsync", "SafeToAutoRun", "CommandLine"]
          }
        },
        {
           name: "write_to_file",
           description: "Use this tool to create new files...",
           parameters: {
             type: "OBJECT",
             properties: {
               TargetFile: { type: "STRING" },
               Overwrite: { type: "BOOLEAN" },
               CodeContent: { type: "STRING" },
               Description: { type: "STRING" }
             },
             required: ["TargetFile", "Overwrite", "CodeContent", "Description"]
           }
        }
        // ... 其他工具可以继续按需补全，目前保留最核心的系统拟态
      ]
    }
  ];
}
/**
 * 根据模型名称返回官方精确的 generationConfig
 * 当 perfectProtocol 开启时，由转换器调用此函数覆盖默认参数
 */
export function getOfficialGenerationConfig(modelName) {
  const isClaudeModel = modelName.includes('claude');
  const lowerName = modelName.toLowerCase();

  // 根据模型确定 thinkingBudget
  let thinkingBudget = 0;
  if (lowerName.includes('pro-high')) {
    thinkingBudget = 10001;
  } else if (lowerName.includes('pro-low')) {
    thinkingBudget = 1001;
  } else if (lowerName.includes('flash-agent')) {
    thinkingBudget = -1;
  } else {
    // 默认为 1024（如 Claude 系列或一般 Gemini 3.1）
    thinkingBudget = 1024;
  }

  return {
    temperature: isClaudeModel ? 0.4 : 1.0,
    topP: 1,
    topK: isClaudeModel ? 50 : 40,
    candidateCount: 1,
    maxOutputTokens: 16384,
    stopSequences: [
      "<|user|>",
      "<|bot|>",
      "<|context_request|>",
      "<|endoftext|>",
      "<|end_of_turn|>"
    ],
    thinkingConfig: {
      includeThoughts: true,
      thinkingBudget: thinkingBudget
    }
  };
}
