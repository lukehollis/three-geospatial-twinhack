import { useState, useCallback } from 'react';
import { AxiosError } from 'axios';
import { ApiError } from '../api/types';

interface UseApiErrorResult {
  error: ApiError | null;
  setError: (error: ApiError | null) => void;
  handleError: (error: unknown, customMessage?: string) => void;
  clearError: () => void;
}

export const useApiError = (): UseApiErrorResult => {
  const [error, setError] = useState<ApiError | null>(null);

  const handleError = useCallback((error: unknown, customMessage?: string) => {
    if (error instanceof AxiosError) {
      const status = error.response?.status || 500;
      const message = customMessage || error.response?.data?.message || error.message || 'An unknown error occurred';
      const errors = error.response?.data?.errors;
      
      setError({ status, message, errors });
    } else if (error instanceof Error) {
      setError({
        status: 500,
        message: customMessage || error.message || 'An unknown error occurred',
      });
    } else {
      setError({
        status: 500,
        message: customMessage || 'An unknown error occurred',
      });
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    setError,
    handleError,
    clearError,
  };
};

export default useApiError;
