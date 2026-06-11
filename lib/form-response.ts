export type FormResult = {
  ok: boolean;
  message: string;
};

export async function readFormResponse(response: Response, fallbackMessage: string): Promise<FormResult> {
  const text = await response.text();

  if (!text) {
    return {
      ok: response.ok,
      message: response.ok ? fallbackMessage : "We could not save that request right now. Please try again shortly."
    };
  }

  try {
    const json = JSON.parse(text) as Partial<FormResult>;
    return {
      ok: response.ok && json.ok !== false,
      message: json.message || fallbackMessage
    };
  } catch {
    return {
      ok: response.ok,
      message: response.ok ? fallbackMessage : "We could not save that request right now. Please try again shortly."
    };
  }
}
