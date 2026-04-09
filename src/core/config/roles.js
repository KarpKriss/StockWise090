export const ROLE_CONFIG = {
  user: {
    home: '/menu',
    permissions: ['process'],
  },
  superuser: {
    home: '/menu',
    permissions: ['process', 'history'],
  },
  manager: {
    home: '/menu',
    permissions: ['process', 'history', 'dashboard'],
  },
  office: {
    home: '/menu',
    permissions: ['process', 'history', 'data'],
  },
  admin: {
    home: '/menu',
    permissions: ['process', 'history', 'data', 'dashboard', 'admin'],
  },
};

export const getHomeRoute = (role) => {
  if (!role) return '/login';
  return ROLE_CONFIG[role.toLowerCase()]?.home || '/login';
};

export const hasPermission = (role, permission) => {
  if (!role) return false;
  return ROLE_CONFIG[role.toLowerCase()]?.permissions.includes(permission);
};
