export const getApiErrorMessage = (error: unknown): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const message = (error as {
      response?: { data?: { message?: string | string[] } };
    }).response?.data?.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join(', ');
  }
  return error instanceof Error ? error.message : 'Request failed';
};
