async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  listPackages: () => request("/packages"),
  getPackage: (id) => request(`/packages/${id}`),
  deletePackage: (id) => request(`/packages/${id}`, { method: "DELETE" }),
  generate: (payload) =>
    request("/packages/generate", { method: "POST", body: JSON.stringify(payload) }),
  chat: (id, messages) =>
    request(`/chat/${id}`, { method: "POST", body: JSON.stringify({ messages }) }),
};
