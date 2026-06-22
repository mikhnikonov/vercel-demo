type JsonBody = {
  json(): Promise<unknown>;
};

export async function readJsonBody(source: JsonBody): Promise<unknown> {
  try {
    return await source.json();
  } catch {
    return null;
  }
}

export function getJsonErrorMessage(data: unknown, fallback: string) {
  if (!isRecord(data)) {
    return fallback;
  }

  const message = data.error ?? data.message;

  return typeof message === "string" && message.trim() ? message : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
