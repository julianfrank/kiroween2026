/** Passwords must be longer than six characters (the user's rule): at least 7. */
export const MIN_PASSWORD_LENGTH = 7;

export function passwordProblem(password: string): string | null {
  return password.length < MIN_PASSWORD_LENGTH ? `Use at least ${MIN_PASSWORD_LENGTH} characters.` : null;
}
