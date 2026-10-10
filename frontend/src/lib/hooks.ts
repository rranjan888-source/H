import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import type { Customer, User } from "@/lib/types";

export function errMsg(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { detail?: unknown } | null;
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail)) return "Please check the required fields";
    return `Request failed (${e.status})`;
  }
  return "Something went wrong";
}

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => apiGet<User>("/auth/me"), retry: false });
}

export function useList<T>(path: string, enabled = true) {
  return useQuery({ queryKey: [path], queryFn: () => apiGet<T[]>(path), enabled });
}

export function useItem<T>(path: string, enabled = true) {
  return useQuery({ queryKey: [path], queryFn: () => apiGet<T>(path), enabled });
}

// Every mutation invalidates the whole cache: data is small and many views are cross-linked.
export function useAction<TRes, TVars = void>(fn: (v: TVars) => Promise<TRes>, success?: string | ((r: TRes) => string)) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      qc.invalidateQueries();
      if (success) toast.success(typeof success === "function" ? success(r) : success);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

export function useSave<TIn, T>(path: string, label: string) {
  return useAction<T, { id?: string; body: TIn }>(
    ({ id, body }) => (id ? apiPut<T>(`${path}/${id}`, body) : apiPost<T>(path, body)),
    `${label} saved`,
  );
}

export function useRemove(path: string, label: string) {
  return useAction<unknown, string>((id) => apiDelete(`${path}/${id}`), `${label} deleted`);
}

// Server-anchored "today" (NZ time) — never derive it from the browser clock.
export function useToday(): string {
  const q = useQuery({ queryKey: ["/today"], queryFn: () => apiGet<{ today: string }>("/today"), staleTime: 60_000 });
  return q.data?.today ?? "";
}

export function useLookups() {
  const customers = useList<Customer>("/customers").data ?? [];
  const users = useList<User>("/users").data ?? [];
  return {
    customers,
    users,
    customerOpts: customers.map((c) => ({ value: c.id, label: c.name })),
    userOpts: [{ value: "", label: "Unassigned" }, ...users.map((u) => ({ value: u.id, label: u.name }))],
    staffOpts: users.map((u) => ({ value: u.id, label: u.name })),
  };
}
