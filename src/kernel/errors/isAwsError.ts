export function isAwsError(error: unknown, name: string): boolean {
  return error instanceof Error && error.name === name;
}
