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
    if (response.status === 413) {
      throw new Error(
        "Upload too large — the server rejected this photo. Try one image at a time or retake closer to the cards.",
      );
    }
    throw new Error(
      response.ok
        ? "Server returned invalid JSON"
        : `Request failed (${response.status}) with a non-JSON response`,
    );
  }
}
