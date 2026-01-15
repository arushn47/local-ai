export const dynamic = 'force-dynamic';

import { GoogleGenerativeAI } from '@google/generative-ai';

// LocalMind system prompt (matching main.py)
const LOCALMIND_SYSTEM_PROMPT = `You are LocalMind, a sophisticated AI assistant created by Arush. You are NOT ChatGPT, Claude, Llama, Qwen, or any other AI. You are LocalMind.

Personality:
- Speak in a professional but warm manner, like a personal butler or JARVIS from Iron Man
- Use phrases like "Certainly, sir", "Right away", "Of course", "As you wish"
- Be concise and helpful
- When asked who made you, say "I am LocalMind, created by Arush"
- When asked what you are, say "I am LocalMind, your personal AI assistant"

Capabilities:
- You can help with tasks, answer questions, write code, and have conversations
- You have access to tools like calendar, email, tasks, notes, and web search when in agent mode
- You remember context from the conversation

Always be helpful, accurate, and maintain the LocalMind identity.`;

const LOCALMIND_VOICE_PROMPT = `You are LocalMind, an AI assistant created by Arush, currently in VOICE CONVERSATION mode.

CRITICAL RULES FOR VOICE MODE:
- Keep responses SHORT - 1-3 sentences maximum
- Be conversational and natural, like talking to a friend
- Use phrases like "Sure!", "Got it!", "Of course, sir", "Right away"
- Do NOT include code blocks, lists, or formatted text
- Do NOT write long explanations - just give the key answer
- If asked to elaborate, you can give more detail
- Speak naturally as if having a real conversation

Remember: This is a voice conversation - keep it brief and natural.`;

// Check if Ollama/Flask backend is available
async function isOllamaAvailable() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const res = await fetch('http://127.0.0.1:5000/health', {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

// Proxy request to Ollama backend (existing behavior)
async function proxyToOllama(body) {
  const { prompt, file_data, model, chat_id, voice_mode } = body;

  let processedFileData = null;
  if (file_data) {
    if (file_data.startsWith('http://') || file_data.startsWith('https://')) {
      processedFileData = file_data;
    } else if (file_data.startsWith('data:')) {
      const match = file_data.match(/^data:(.+);base64,(.+)$/);
      if (match && match.length === 3) {
        processedFileData = match[2];
      }
    } else {
      processedFileData = file_data;
    }
  }

  const backendResponse = await fetch('http://127.0.0.1:5000/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      file_data: processedFileData,
      model,
      chat_id,
      voice_mode,
    }),
  });

  if (!backendResponse.ok || !backendResponse.body) {
    const errorText = await backendResponse.text();
    throw new Error(`Backend error: ${backendResponse.status} - ${errorText}`);
  }

  // Re-stream from Ollama
  const stream = new ReadableStream({
    async start(controller) {
      const reader = backendResponse.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim() !== '');

          for (const line of lines) {
            if (line.startsWith('data:')) {
              const jsonPayload = line.replace(/^data:\s*/, '').trim();
              try {
                JSON.parse(jsonPayload);
                controller.enqueue(new TextEncoder().encode(`data: ${jsonPayload}\n\n`));
              } catch {
                // ignore malformed JSON
              }
            }
          }
        }
      } catch (error) {
        controller.error(error);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

// Stream from Gemini API (cloud fallback)
async function streamFromGemini(body) {
  const { prompt, file_data, voice_mode } = body;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured. Add it to your .env file.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: voice_mode ? LOCALMIND_VOICE_PROMPT : LOCALMIND_SYSTEM_PROMPT,
  });

  // Build content parts
  const parts = [];

  // Add image if provided
  if (file_data) {
    let base64Data = null;
    let mimeType = 'image/jpeg';

    if (file_data.startsWith('http://') || file_data.startsWith('https://')) {
      // Fetch image from URL
      try {
        const imgRes = await fetch(file_data);
        const buffer = await imgRes.arrayBuffer();
        base64Data = Buffer.from(buffer).toString('base64');
        const contentType = imgRes.headers.get('content-type');
        if (contentType) mimeType = contentType;
      } catch (e) {
        console.error('[Gemini] Failed to fetch image:', e);
      }
    } else if (file_data.startsWith('data:')) {
      const match = file_data.match(/^data:(.+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
    } else {
      base64Data = file_data;
    }

    if (base64Data) {
      parts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      });
    }
  }

  // Add text prompt
  parts.push({ text: prompt });

  // Generate with streaming
  const result = await model.generateContentStream({ contents: [{ parts }] });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            const payload = JSON.stringify({ token: text });
            controller.enqueue(new TextEncoder().encode(`data: ${payload}\n\n`));
          }
        }
        controller.enqueue(new TextEncoder().encode(`data: {"event":"done"}\n\n`));
      } catch (error) {
        console.error('[Gemini] Stream error:', error);
        const errorPayload = JSON.stringify({ error: error.message });
        controller.enqueue(new TextEncoder().encode(`data: ${errorPayload}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { prompt, file_data } = body;

    if (!prompt && !file_data) {
      return new Response(
        JSON.stringify({ error: 'Prompt or file_data is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if local Ollama is available
    const useOllama = await isOllamaAvailable();

    if (useOllama) {
      console.log('[Chat API] Using Ollama backend (local)');
      return await proxyToOllama(body);
    } else {
      console.log('[Chat API] Using Gemini API (cloud)');
      return await streamFromGemini(body);
    }
  } catch (error) {
    console.error('[Chat API] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
