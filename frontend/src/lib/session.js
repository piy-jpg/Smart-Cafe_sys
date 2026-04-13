export const getStoredUser = () => {
  try {
    const rawUser = localStorage.getItem('smartCafeUser');
    return rawUser ? JSON.parse(rawUser) : null;
  } catch (error) {
    console.error('Failed to read stored user', error);
    return null;
  }
};

export const clearSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('smartCafeUser');
};

export const storeSession = ({ token, user }) => {
  if (token) {
    localStorage.setItem('token', token);
  }

  if (user) {
    localStorage.setItem('smartCafeUser', JSON.stringify(user));
  }
};

export const getAllowedRoutesForRole = (role) => {
  switch (role) {
    case 'waiter':
    case 'staff':
    case 'master_waiter':
      return ['/waiter'];
    case 'chef':
      return ['/kitchen'];
    case 'manager':
      return ['/waiter', '/kitchen', '/manager'];
    case 'owner':
      return ['/waiter', '/kitchen', '/manager', '/owner'];
    default:
      return [];
  }
};

export const getDefaultRouteForRole = (role) => {
  if (role === 'chef') return '/kitchen';
  if (role === 'manager') return '/manager';
  if (role === 'owner') return '/owner';
  return '/waiter';
};

export const canAccessRoute = (role, pathname) => (
  getAllowedRoutesForRole(role).includes(pathname)
);
