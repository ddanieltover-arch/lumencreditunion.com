/** Build a member-facing message from API error envelopes (incl. Zod details). */
export function formatApiError(
  data: { message?: string; details?: Array<{ path?: string; message?: string }> | unknown },
  fallback = 'Something went wrong. Please try again.',
): string {
  const detailList = Array.isArray(data?.details)
    ? data.details
        .map((d) => (typeof d?.message === 'string' ? d.message.trim() : ''))
        .filter(Boolean)
    : [];

  if (detailList.length > 0) {
    // Prefer specific field messages over the generic "Validation failed"
    const unique = [...new Set(detailList)];
    return unique.join(' ');
  }

  return (typeof data?.message === 'string' && data.message.trim()) || fallback;
}
