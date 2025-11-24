export async function fetchJSON(url: string, options?: RequestInit): Promise<unknown> {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`Error fetching ${url}: ${response.statusText}`);
    }
    return await response.json();
}

export async function postJSON(
    url: string,
    body: unknown,
    headers = { "Content-Type": "application/json" },
): Promise<unknown> {
    return fetchJSON(url, { method: "POST", headers, body: JSON.stringify(body) });
}

export function toBytes16(uuid: string): string {
    return `0x${uuid.replace(/-/g, "")}`;
}
