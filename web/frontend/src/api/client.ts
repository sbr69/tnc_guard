/// <reference types="vite/client" />
import { components } from './types';

type DocumentAnalysisResult = components['schemas']['DocumentAnalysisResult'];

const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');

export async function uploadDocumentFile(file: File, documentType: string = 'custom'): Promise<{ id: string; status: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('document_type', documentType);
  
  const response = await fetch(`${API_BASE}/api/documents`, {
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
  
  const response = await fetch(`${API_BASE}/api/documents`, {
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
  
  const response = await fetch(`${API_BASE}/api/documents`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || 'Failed to analyze URL.');
  }
  
  return response.json();
}

export async function getDocumentAnalysis(id: string): Promise<DocumentAnalysisResult> {
  const response = await fetch(`${API_BASE}/api/documents/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch document analysis.');
  }
  return response.json();
}

export async function getDemoDocuments(): Promise<DocumentAnalysisResult[]> {
  const response = await fetch(`${API_BASE}/api/documents/demo/all`);
  if (!response.ok) {
    throw new Error('Failed to fetch demo documents.');
  }
  return response.json();
}
