export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

function handleUnauthorized(status: number) {
  if (status === 401 && window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    handleUnauthorized(response.status);
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Request failed");
  }
  return response.json();
}

export async function apiDownload(path: string, options: RequestInit = {}): Promise<Blob> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
  });

  if (!response.ok) {
    handleUnauthorized(response.status);
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Download failed");
  }

  return response.blob();
}

export function uploadFile<T>(
  path: string,
  file: File,
  onProgress: (progress: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    request.open("POST", `${API_BASE}${path}`);
    request.withCredentials = true;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onload = () => {
      const data = request.responseText ? JSON.parse(request.responseText) : {};
      if (request.status >= 200 && request.status < 300) {
        resolve(data as T);
        return;
      }
      handleUnauthorized(request.status);
      reject(new Error(data.detail || "Upload failed"));
    };
    request.onerror = () => reject(new Error("Upload failed"));
    request.send(formData);
  });
}
