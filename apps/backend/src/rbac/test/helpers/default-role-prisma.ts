/** Minimal transaction context for tests of registration and administrative creation. */
export const defaultRoleTransactionFields = () => ({
  $queryRaw: async () => [],
  rbacSettings: {
    findUnique: async () => ({ defaultRole: { id: 'default-user-role', name: 'User', permissions: [] } }),
  },
});

export const withDefaultUserRole = (user: { create: jest.Mock }) => {
  const tx = { ...defaultRoleTransactionFields(), user };
  return { ...tx, $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) => callback(tx) };
};
