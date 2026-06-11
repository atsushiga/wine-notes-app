export async function uploadImageFile(file: File | Blob, filename: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", file, filename);
  formData.append("filename", filename);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const payload = await response.json().catch(() => ({})) as {
    getUrl?: string;
    error?: string;
  };

  if (!response.ok || payload.error || !payload.getUrl) {
    throw new Error(payload.error || "Upload failed");
  }

  return payload.getUrl;
}
