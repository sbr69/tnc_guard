/// <reference types="vite/client" />
import { components } from './types';

type DocumentAnalysisResult = components['schemas']['DocumentAnalysisResult'];

const API_BASE =
  ((import.meta.env.VITE_WORKER_URL as string | undefined) ?? 'http://127.0.0.1:8787').replace(/\/$/, '');

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 2
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchWithTimeout(url, options);
    } catch (err: any) {
      if (attempt === maxRetries || err.name === 'AbortError') throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
  throw new Error('Unreachable');
}

export async function uploadDocumentFile(file: File, documentType: string = 'custom'): Promise<{ id: string; status: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('document_type', documentType);
  
  const response = await fetchWithRetry(`${API_BASE}/api/documents`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || 'Failed to upload document file.');
  }
  
  return response.json();
}

export async function uploadDocumentText(text: string, documentType: string = 'custom'): Promise<{ id: string; status: string }> {
  const formData = new FormData();
  formData.append('raw_text', text);
  formData.append('document_type', documentType);
  
  const response = await fetchWithRetry(`${API_BASE}/api/documents`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || 'Failed to upload document text.');
  }
  
  return response.json();
}

export async function uploadDocumentUrl(url: string, documentType: string = 'custom'): Promise<{ id: string; status: string }> {
  const formData = new FormData();
  formData.append('url', url);
  formData.append('document_type', documentType);
  
  const response = await fetchWithRetry(`${API_BASE}/api/documents`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || 'Failed to analyze URL.');
  }
  
  return response.json();
}

export async function getDocumentAnalysis(id: string, opts?: { signal?: AbortSignal }): Promise<DocumentAnalysisResult> {
  const response = await fetchWithTimeout(`${API_BASE}/api/documents/${id}`, { signal: opts?.signal });
  if (!response.ok) {
    throw new Error('Failed to fetch document analysis.');
  }
  return response.json();
}

export async function getDemoDocuments(): Promise<DocumentAnalysisResult[]> {
  const response = await fetchWithTimeout(`${API_BASE}/api/documents/demo/all`);
  if (!response.ok) {
    throw new Error('Failed to fetch demo documents.');
  }
  return response.json();
}
