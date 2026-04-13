const resolveApiBaseUrl = () => {
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (envBaseUrl) {
    return envBaseUrl.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const { hostname, port, origin } = window.location;
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.');
    const isViteDevPort = ['6003', '6004', '6005'].includes(String(port || ''));
    if (isLocalHost && isViteDevPort) {
      return '';
    }
    if (isLocalHost) {
      return `http://${hostname}:5006`;
    }
    return origin.replace(/\/+$/, '');
  }

  return 'http://localhost:5006';
};

export const API_BASE_URL = resolveApiBaseUrl();
export const SOCKET_BASE_URL = API_BASE_URL || undefined;

export const formatOrderSerial = (order) => {
  const value = order?.serial_no ?? order?.id ?? 0;
  return String(value).padStart(4, '0');
};

export const formatOrderLocation = (order) => {
  if (order?.table_label) return order.table_label;
  return `Table ${order?.table_number ?? ''}`.trim();
};
