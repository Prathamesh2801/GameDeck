import { useCallback, useEffect, useState } from "react";

const TOKEN_KEY = "gamedeck_admin_token";

export const auth = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// fetch wrapper for /api: JSON in/out, admin token attached, server errors
// thrown as Error(message). A 401 on an admin route means the login expired.
export async function api(path, { method = "GET", body } = {}) {
  const token = auth.get();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body && { "content-type": "application/json" }),
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: body && JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path.startsWith("/admin/") && path !== "/admin/login") {
    auth.clear();
    window.location.assign("/admin/login");
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// Loads `path` on mount; `reload()` refetches (e.g. after a mutation).
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const reload = useCallback(
    () =>
      api(path).then(
        (data) => setState({ data, error: null, loading: false }),
        (error) => setState((s) => ({ ...s, error, loading: false })),
      ),
    [path],
  );
  useEffect(() => {
    reload();
  }, [reload]);
  return { ...state, reload };
}
