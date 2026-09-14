// Shared by authService and usersService — never let a passwordHash leak into an API response.
export function omitPasswordHash<T extends { passwordHash: string }>(
  user: T,
): Omit<T, 'passwordHash'> {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}
