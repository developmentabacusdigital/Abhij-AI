import { NextRequest, NextResponse } from 'next/server';
import { searchRelevantKnowledge } from '@/lib/knowledge';
import { streamOpenRouterChat, ChatMessage } from '@/lib/openrouter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required.' },
        { status: 400 }
      );
    }

    const latestUserMessage = [...messages].reverse().find(m => m.role === 'user');
    const query = latestUserMessage ? latestUserMessage.content : '';

    // Search knowledge base for relevant context
    const { contextString, usedFilenames, sections, isGreeting } = await searchRelevantKnowledge(query);

    // Call OpenRouter with streaming
    const openRouterResponse = await streamOpenRouterChat({
      messages: messages as ChatMessage[],
      context: contextString,
      sources: usedFilenames,
      isGreeting,
    });

    // Create a transform stream to pass through SSE chunks and encode source metadata
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', 'text/event-stream');
    responseHeaders.set('Cache-Control', 'no-cache, no-transform');
    responseHeaders.set('Connection', 'keep-alive');
    responseHeaders.set('X-Sources', JSON.stringify(usedFilenames));
    responseHeaders.set('X-Sections-Count', sections.length.toString());

    return new Response(openRouterResponse.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error while processing query.' },
      { status: 500 }
    );
  }
}
