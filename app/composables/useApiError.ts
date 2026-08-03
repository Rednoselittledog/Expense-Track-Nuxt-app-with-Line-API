export function extractErrorMessage(e: unknown): string {
  return (e as any)?.data?.statusMessage ?? (e as Error)?.message ?? 'unknown error'
}
