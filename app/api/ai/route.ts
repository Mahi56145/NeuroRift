export async function POST(req: Request) {
  const { data } = await req.json();

  const sample = data.slice(0, 5);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Analyze this dataset:\n${JSON.stringify(sample)}`,
              },
            ],
          },
        ],
      }),
    }
  );

  const result = await response.json();
  console.log("GEMINI RESPONSE:", result);

  return new Response(
    JSON.stringify({
      insight: result.candidates?.[0]?.content?.parts?.[0]?.text || "No response",
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}