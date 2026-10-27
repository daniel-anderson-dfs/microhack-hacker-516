import axios from 'axios';
import { api } from './config';

export interface CartItem {
  productId: number;
  name: string;
  sku: string;
  imgName: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface Cart {
  items: CartItem[];
  itemCount: number;
  totalCents: number;
}

export const emptyCart: Cart = { items: [], itemCount: 0, totalCents: 0 };
export const cartStorageKey = `octocat-cart:${api.baseURL}`;
const listeners = new Set<() => void>();
function readToken(): string | null {
  try { return localStorage.getItem(cartStorageKey); } catch { return null; }
}
let snapshot = { token: readToken(), notice: '' };

function publish(token: string | null, notice = '') {
  snapshot = { token, notice };
  listeners.forEach((listener) => listener());
}

export const cartSession = {
  getSnapshot: () => snapshot,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

window.addEventListener('storage', (event) => {
  if (event.key === cartStorageKey || event.key === null) {publish(readToken());}
});

let creation: Promise<string> | undefined;
export async function ensureCartToken(): Promise<string> {
  if (snapshot.token) {return snapshot.token;}
  if (!creation) {
    creation = (async () => {
      const { data } = await axios.post<{ token: string; cart: Cart }>(
        `${api.baseURL}${api.endpoints.carts}`,
      );
      try {
        localStorage.setItem(cartStorageKey, data.token);
      } catch {
        throw new Error('Allow browser storage before adding items so your cart can be restored.');
      }
      publish(data.token);
      return data.token;
    })().finally(() => { creation = undefined; });
  }
  return creation;
}

export function cartErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ error?: { message?: string } }>(error)) {
    return error.response?.data.error?.message ?? 'Could not reach your cart. Check your connection and try again.';
  }
  return error instanceof Error ? error.message : 'Could not update your cart. Try again.';
}

export async function cartRequest(
  token: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', suffix = '',
  data?: { productId?: number; quantity: number }, signal?: AbortSignal,
): Promise<Cart> {
  try {
    const response = await axios.request<Cart>({
      url: `${api.baseURL}${api.endpoints.cart}${suffix}`,
      method, data, signal, headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401 && snapshot.token === token) {
      try { localStorage.removeItem(cartStorageKey); } catch { /* Storage may have been disabled. */ }
      publish(null, 'Your saved cart is no longer available. Add products to start a new cart.');
    }
    throw error;
  }
}

export const formatCartMoney = (cents: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
