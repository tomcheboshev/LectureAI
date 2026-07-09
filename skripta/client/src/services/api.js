import axios from "axios";

const http = axios.create({ baseURL: "/api" });

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.error || err.message || "Request failed";
    return Promise.reject(new Error(message));
  }
);

export const api = {
  listPackages: () => http.get("/packages").then((r) => r.data),
  getPackage: (id) => http.get(`/packages/${id}`).then((r) => r.data),
  deletePackage: (id) => http.delete(`/packages/${id}`).then((r) => r.data),
  generate: (payload) => http.post("/packages/generate", payload).then((r) => r.data),
  chat: (id, messages) => http.post(`/chat/${id}`, { messages }).then((r) => r.data),
};
