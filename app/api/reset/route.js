export async function POST(req) {
  try {
    const res = await fetch('http://127.0.0.1:5000/reset', {
      method: 'POST',
    });

    if (!res.ok) {
      throw new Error('Failed to reset backend');
    }
    const json = await res.json();
    return new Response(JSON.stringify(json), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
