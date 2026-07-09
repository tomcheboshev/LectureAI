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
  generateFromYoutube: (payload) => http.post("/packages/from-youtube", payload).then((r) => r.data),
  generateFromFiles: (formData, onUploadProgress) =>
    http
      .post("/packages/from-files", formData, { headers: { "Content-Type": "multipart/form-data" }, onUploadProgress })
      .then((r) => r.data),
  regenerateSection: (id, section) => http.post(`/packages/${id}/regenerate`, { section }).then((r) => r.data),
  explainConcept: (id, payload) => http.post(`/packages/${id}/explain`, payload).then((r) => r.data),
  chat: (id, messages) => http.post(`/chat/${id}`, { messages }).then((r) => r.data),
  getChatHistory: (id) => http.get(`/chat/${id}`).then((r) => r.data),
  clearChatHistory: (id) => http.delete(`/chat/${id}`).then((r) => r.data),
};
