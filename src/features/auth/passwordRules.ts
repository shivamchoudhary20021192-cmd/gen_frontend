/** The rules the API applies to a new password, said before it refuses one. */
export const PASSWORD_HINT = 'At least 10 characters, with an upper-case letter, a lower-case letter and a number.'

export function passwordProblem(password: string): string | null {
  if (password.length < 10) return 'Use at least 10 characters.'
  if (!/[a-z]/.test(password)) return 'Add a lower-case letter.'
  if (!/[A-Z]/.test(password)) return 'Add an upper-case letter.'
  if (!/[0-9]/.test(password)) return 'Add a number.'
  return null
}
