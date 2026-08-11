import { useState, useCallback, useRef, useEffect } from 'react';
import { components } from '../api/types';
import { uploadDocumentFile, uploadDocumentText, uploadDocumentUrl, getDocumentAnalysis, getDemoDocuments } from '../api/client';

type DocumentAnalysisResult = components['schemas']['DocumentAnalysisResult'];

export function useDocumentAnalysis() {
  const [document, setDocument] = useState<DocumentAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressStep, setProgressStep] = useState<string>('');
  const [progressPercentage, setProgressPercentage] = useState<number | null>(null);
  
  const pollingTimeoutRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  
  const clearPolling = useCallback(() => {
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  }, []);

  const pollDocument = useCallback(async (docId: string, stepCount: number = 0) => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      const res = await getDocumentAnalysis(docId, { signal: abortControllerRef.current.signal });
      
      if (res.status === 'processing') {
        const steps = [
          'Extracting provision boundaries...',
          'Hashing clauses & checking cache...',
          'Retrieving standard references (RAG)...',
          'Analyzing clauses with Gemini Flash...',
          'Aggregating scores & compiling report...'
        ];
        
        const currentStepIdx = Math.min(stepCount, steps.length - 1);
        setProgressStep(steps[currentStepIdx]);
        
        const percentage = Math.min(10 + stepCount * 18, 95);
        setProgressPercentage(percentage);
        
        pollingTimeoutRef.current = setTimeout(() => {
          pollDocument(docId, stepCount + 1);
        }, 2500);
      } else if (res.status === 'done') {
        setProgressPercentage(100);
        setProgressStep('Analysis complete!');
        setTimeout(() => {
          setDocument(res);
          setLoading(false);
          setProgressPercentage(null);
        }, 500);
      } else if (res.status === 'error') {
        setError(res.errorMessage || 'An error occurred during analysis.');
        setLoading(false);
        setProgressPercentage(null);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Failed to poll document status.');
      setLoading(false);
      setProgressPercentage(null);
    }
  }, []);

  const startFileAnalysis = useCallback(async (file: File, docType: string = 'custom') => {
    setLoading(true);
    setError(null);
    setDocument(null);
    setProgressStep('Uploading document file...');
    setProgressPercentage(5);
    clearPolling();
    
    try {
      const res = await uploadDocumentFile(file, docType);
      pollDocument(res.id);
    } catch (err: any) {
      setError(err.message || 'Failed to start file analysis.');
      setLoading(false);
      setProgressPercentage(null);
    }
  }, [pollDocument, clearPolling]);

  const startTextAnalysis = useCallback(async (text: string, docType: string = 'custom') => {
    setLoading(true);
    setError(null);
    setDocument(null);
    setProgressStep('Submitting agreement text...');
    setProgressPercentage(5);
    clearPolling();
    
    try {
      const res = await uploadDocumentText(text, docType);
      pollDocument(res.id);
    } catch (err: any) {
      setError(err.message || 'Failed to start text analysis.');
      setLoading(false);
      setProgressPercentage(null);
    }
  }, [pollDocument, clearPolling]);

  const startDemoAnalysis = useCallback(async (docId: string) => {
    setLoading(true);
    setError(null);
    setDocument(null);
    setProgressStep('Loading demo report...');
    setProgressPercentage(30);
    clearPolling();
    
    try {
      const demos = await getDemoDocuments();
      const match = demos.find(d => d.id === docId);
      if (match) {
        setProgressPercentage(100);
        setTimeout(() => {
          setDocument(match);
          setLoading(false);
          setProgressPercentage(null);
        }, 3000);
      } else {
        throw new Error('Demo document not found.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load demo document.');
      setLoading(false);
      setProgressPercentage(null);
    }
  }, [clearPolling]);

  const startUrlAnalysis = useCallback(async (url: string, docType: string = 'custom') => {
    setLoading(true);
    setError(null);
    setDocument(null);
    setProgressStep('Fetching document from URL...');
    setProgressPercentage(5);
    clearPolling();
    
    try {
      const res = await uploadDocumentUrl(url, docType);
      pollDocument(res.id);
    } catch (err: any) {
      setError(err.message || 'Failed to start URL analysis.');
      setLoading(false);
      setProgressPercentage(null);
    }
  }, [pollDocument, clearPolling]);

  const loadResult = useCallback((result: DocumentAnalysisResult) => {
    clearPolling();
    setDocument(result);
    setLoading(false);
    setError(null);
    setProgressStep('');
    setProgressPercentage(null);
  }, [clearPolling]);

  const reset = useCallback(() => {
    setDocument(null);
    setLoading(false);
    setError(null);
    setProgressStep('');
    setProgressPercentage(null);
    clearPolling();
  }, [clearPolling]);

  return {
    document,
    loading,
    error,
    progressStep,
    progressPercentage,
    startFileAnalysis,
    startTextAnalysis,
    startUrlAnalysis,
    startDemoAnalysis,
    loadResult,
    reset
  };
}
