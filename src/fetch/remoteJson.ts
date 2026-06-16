import { fetchRemoteText } from "./remoteFetch";

export async function fetchRemoteJson<T>(url: string, timeoutMs = 22_000): Promise<T> {
  const text = await fetchRemoteText(url, timeoutMs);
  return JSON.parse(text) as T;
}
