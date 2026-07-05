import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export interface ApiClientOptions {
  baseURL: string;
  /** Path (relative to baseURL) that exchanges the refresh token for a new access token. */
  refreshPath?: string;
  /** Extra headers sent on every request (e.g. mobile's `x-client-platform: mobile`). */
  defaultHeaders?: Record<string, string>;
  getAccessToken: () => string | null;
  setAccessToken: (token: string | null) => void;
  /**
   * Body to send with the refresh request. Web/admin leave this undefined
   * (the refresh token travels in the httpOnly cookie); mobile supplies
   * `{ refreshToken }` read from expo-secure-store since RN has no cookie jar.
   */
  getRefreshRequestBody?: () => Record<string, unknown> | undefined;
  /** Called with the full refresh response body — mobile uses this to persist the rotated refreshToken. */
  onRefreshSuccess?: (data: any) => void;
  /** Called when the refresh itself fails — e.g. redirect to /auth/login. */
  onAuthFailure?: () => void;
}

/**
 * Axios client per S2: access token attached from in-memory storage only
 * (never localStorage/AsyncStorage). On a 401, concurrent requests share a
 * single in-flight refresh call instead of each firing their own.
 */
export function createApiClient(options: ApiClientOptions): AxiosInstance {
  const client = axios.create({
    baseURL: options.baseURL,
    withCredentials: true,
    headers: options.defaultHeaders,
  });

  const refreshPath = options.refreshPath ?? "/auth/refresh";
  let refreshPromise: Promise<string | null> | null = null;

  client.interceptors.request.use((config) => {
    const token = options.getAccessToken();
    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error.config as RetryableConfig | undefined;

      const isAuthEndpoint = original?.url?.includes(refreshPath);
      if (error.response?.status !== 401 || !original || original._retry || isAuthEndpoint) {
        return Promise.reject(error);
      }

      original._retry = true;

      if (!refreshPromise) {
        refreshPromise = client
          .post(refreshPath, options.getRefreshRequestBody?.())
          .then((res) => {
            const token = res.data.accessToken as string;
            options.setAccessToken(token);
            options.onRefreshSuccess?.(res.data);
            return token;
          })
          .catch(() => {
            options.setAccessToken(null);
            options.onAuthFailure?.();
            return null;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      const token = await refreshPromise;
      if (!token) {
        return Promise.reject(error);
      }

      original.headers.set("Authorization", `Bearer ${token}`);
      return client(original);
    },
  );

  return client;
}
