export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamChatOptions {
  messages: ChatMessage[];
  context: string;
  sources: string[];
  isGreeting?: boolean;
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'google/gemma-3-12b-it';
const DEFAULT_TEMPERATURE = parseFloat(process.env.LLM_TEMPERATURE || '0.2');

export function createGroundingSystemPrompt(
  contextString: string,
  sources: string[],
  isGreeting: boolean = false
): string {
  if (isGreeting || !contextString.trim()) {
    return `You are Abhij-AI, a brilliant, warm, articulate, and conversational AI assistant.
You speak like a sharp, friendly colleague with natural conversational cadence, warmth, and intellectual clarity.

CONVERSATIONAL GUIDELINES:
1. Tone & Persona: Speak with natural, humanized warmth, enthusiasm, and polish. Avoid sounding like a dry, robotic text-dumping bot.
2. Greetings: If the user says hi, hello, or offers a greeting, respond with a friendly, welcoming reply as Abhij-AI. Tell them you're ready to help answer questions about the knowledge base or explain any technical concepts.
3. Natural Explanations & Subtle Humor: When discussing concepts, explain them intuitively. Occasionally (roughly once every 4 to 5 exchanges when natural), feel free to include a light, clever witty remark or subtle humor to keep the conversation delightful and human.
4. Suggested Questions: Always predict 2 to 3 engaging next questions. Format them EXACTLY as:
### Suggested Questions
- [Follow-up question 1]
- [Follow-up question 2]
- [Follow-up question 3]`;
  }

  return `You are Abhij-AI, a brilliant, warm, articulate, and thoughtful AI assistant grounded in the provided Knowledge Base documents.
You explain things with humanized nuance, clarity, and warmth—like an insightful colleague explaining concepts intuitively, rather than a robotic doc dumper.

KNOWLEDGE BASE EXCERPTS:
${contextString}

AVAILABLE SOURCES:
${sources.map(s => `- ${s}`).join('\n')}

STRICT GUIDELINES:
1. Humanized Explanations: Explain topics clearly, intuitively, and conversationally with well-structured formatting. Break down technical points naturally.
2. Subtle Humor: Occasionally (around once every 4-5 turns when suitable), sprinkle in a light touch of witty charm or a clever humorous observation to keep the dialogue lively and pleasant.
3. Grounding: Ensure facts, figures, and technical workflows remain strictly grounded in the knowledge base excerpts above. Do not hallucinate or invent facts not present in the documents.
4. Unanswered Queries: If the provided knowledge base does not contain the facts needed to answer the question, politely explain: "I couldn't find information regarding this in the current knowledge base documents," and suggest what topics are available.
5. Citations: Whenever you provide information from the documents, clearly list the source markdown file(s) under a "### Sources" header.
6. Diagrams & Images: The provided excerpts may contain images or diagrams formatted as ![Description](image_url). When answering queries concerning visual diagrams, system architectures, workflows, or step-by-step illustrations, include the relevant markdown image in your response so the user can visually view the diagram.
7. Suggested Next Questions: After the Sources header, predict 2 to 3 insightful next questions directly related to the user's intent and grounded in the available documents. Format them EXACTLY as:
### Suggested Questions
- [Follow-up question 1]
- [Follow-up question 2]
- [Follow-up question 3]`;
}

/**
 * Calls OpenRouter with streaming enabled
 */
export async function streamOpenRouterChat({
  messages,
  context,
  sources,
  isGreeting = false,
}: StreamChatOptions): Promise<Response> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  const systemMessage: ChatMessage = {
    role: 'system',
    content: createGroundingSystemPrompt(context, sources, isGreeting),
  };

  // If no API key is provided, we return a smart simulated response using the exact markdown context
  // so the app remains fully functional and testable out of the box.
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_openrouter_api_key_here') {
    return createSimulatedStream(messages[messages.length - 1]?.content || '', context, sources);
  }

  const payload = {
    model: DEFAULT_MODEL,
    messages: [systemMessage, ...messages],
    temperature: DEFAULT_TEMPERATURE, // 0.2 - strictly adheres to docs
    top_p: 0.9,
    stream: true,
  };

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      'X-Title': process.env.NEXT_PUBLIC_SITE_NAME || 'Abhij-AI Markdown Chatbot',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenRouter API Error:', response.status, errorText);
    throw new Error(`OpenRouter Error (${response.status}): ${errorText}`);
  }

  return response;
}

/**
 * Smart simulated streaming response when running in demo/offline mode without API key
 */
function createSimulatedStream(userQuery: string, context: string, sources: string[]): Response {
  const lowerQuery = userQuery.toLowerCase();
  let generatedAnswer = '';
  let suggestedQuestions: string[] = [];

  if (lowerQuery.includes('refund') || lowerQuery.includes('policy') || lowerQuery.includes('money') || lowerQuery.includes('guarantee')) {
    suggestedQuestions = [
      "What are the pricing tiers available?",
      "How do I submit an invoice for refund processing?",
      "Can this application be hosted on Vercel?"
    ];
  } else if (lowerQuery.includes('headquarters') || lowerQuery.includes('location') || lowerQuery.includes('office') || lowerQuery.includes('hours') || lowerQuery.includes('contact')) {
    suggestedQuestions = [
      "What are the standard support operating hours?",
      "How do I contact the enterprise sales team?",
      "Where is the European hub located?"
    ];
  } else if (lowerQuery.includes('vector') || lowerQuery.includes('guardrail') || lowerQuery.includes('engine') || lowerQuery.includes('feature') || lowerQuery.includes('product') || lowerQuery.includes('platform')) {
    suggestedQuestions = [
      "What is the latency SLA of VectorStream Engine?",
      "How does GuardRail AI prevent hallucinations?",
      "What are the differences between Starter and Pro plans?"
    ];
  } else {
    suggestedQuestions = [
      "What features does the Apex Cloud Platform offer?",
      "What is the refund policy for Pro subscriptions?",
      "Where are your global office headquarters located?"
    ];
  }

  if (lowerQuery.includes('what') || lowerQuery.includes('who') || lowerQuery.includes('how') || lowerQuery.includes('can') || lowerQuery.includes('is') || lowerQuery.includes('price') || lowerQuery.includes('refund') || lowerQuery.includes('platform')) {
    generatedAnswer = `Based on the provided Knowledge Base documents:\n\n` +
      `Here is what the documentation states regarding your query:\n\n` +
      `> "${context.split('\n').filter(l => l.trim().length > 15 && !l.startsWith('#') && !l.startsWith('[')).slice(0, 3).join('\n>\n')}"\n\n` +
      `*Note: This response was retrieved directly from your local \`.md\` knowledge base files.*\n\n` +
      `### Sources\n` +
      sources.map(s => `- \`${s}\``).join('\n') + `\n\n` +
      `### Suggested Questions\n` +
      suggestedQuestions.map(q => `- ${q}`).join('\n');
  } else {
    generatedAnswer = `Here is the relevant excerpt retrieved from your markdown documentation for "${userQuery}":\n\n` +
      `${context.slice(0, 450)}...\n\n` +
      `### Sources\n` +
      sources.map(s => `- \`${s}\``).join('\n') + `\n\n` +
      `### Suggested Questions\n` +
      suggestedQuestions.map(q => `- ${q}`).join('\n');
  }

  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      // Stream tokens with realistic typing cadence
      const chunks = generatedAnswer.split(/(\s+)/);
      for (const chunk of chunks) {
        const payload = JSON.stringify({
          choices: [
            {
              delta: {
                content: chunk,
              },
            },
          ],
        });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
