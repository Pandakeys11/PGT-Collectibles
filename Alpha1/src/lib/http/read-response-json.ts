export async function readResponseJson<T extends Record<string, unknown>>(
  response: Response,
): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      response.ok
        ? "Server returned invalid JSON"
        : `Request failed (${response.status}) with a non-JSON response`,
    );
  }
}
