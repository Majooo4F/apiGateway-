export const supabaseFetch = async (table, body) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "apikey":        supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
      "Prefer":        "return=minimal"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Supabase error: ${err}`);
  }

  return response;
};