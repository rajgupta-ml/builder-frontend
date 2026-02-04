import axios from "axios";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "https://api.algorithmicintelmatrix.com/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config) => {
    console.log("AXIOS REQUEST:", config.url, config.baseURL);
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.algorithmicintelmatrix.com/api";
        const res = await axios.post(
          `${apiUrl}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const { token } = res.data;
        if (token) {
            localStorage.setItem("token", token);
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
        }
      } catch (refreshError) {
        localStorage.removeItem("token");
        if (typeof window !== "undefined") {
           // Redirect only if not already on login page to avoid loops
           if (!window.location.pathname.includes('/')) {
                window.location.href = "/";
           }
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
