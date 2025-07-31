export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { prompt, image_data, model } = await req.json();

    if (!prompt && !image_data) {
      return new Response(
        JSON.stringify({ error: 'Prompt or image_data is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    let image_base64 = null;
    let file_type = null;

    if (image_data) {
      const match = image_data.match(/^data:(.+);base64,(.+)$/);
      if (!match || match.length !== 3) {
        return new Response(
          JSON.stringify({ error: 'Invalid image_data format' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      const mimeType = match[1];
      image_base64 = match[2];
      file_type = mimeType.startsWith('application/pdf') ? 'pdf' : 'image';
    }

    const backendResponse = await fetch('http://127.0.0.1:5000/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        file_type,
        file_data: image_base64,
        model,
      }),
    });

    if (!backendResponse.ok || !backendResponse.body) {
      const errorText = await backendResponse.text();
      return new Response(
        JSON.stringify({
          error: `Backend error: ${backendResponse.status}`,
          details: errorText,
        }),
        {
          status: backendResponse.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

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
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
