export type FormResult = {
  ok: boolean;
  message: string;
};

export async function readFormResponse(response: Response, fallbackMessage: string): Promise<FormResult> {
  const text = await response.text();

  if (!text) {
    return {
      ok: response.ok,
      message: response.ok ? fallbackMessage : "The form backend returned an empty response."
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
      message: response.ok ? fallbackMessage : "The form backend returned an unexpected response."
    };
  }
}
