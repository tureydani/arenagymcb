import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem('personalToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      sessionStorage.removeItem('personalToken');
      sessionStorage.removeItem('personal');
      // Reemplaza toda la página (no es una navegación de router de React)
      // para garantizar que se limpie cualquier estado en memoria.
      window.location.replace('/');
    }
    return Promise.reject(error);
  }
);

export default api;
