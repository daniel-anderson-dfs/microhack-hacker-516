import { useSyncExternalStore } from 'react';
import { useIsMutating, useMutation, useQuery, useQueryClient } from 'react-query';
import { api } from '../api/config';
import { cartRequest, cartSession, emptyCart, ensureCartToken } from '../api/cart';

type CartAction =
  | { type: 'add'; productId: number; quantity: number }
  | { type: 'update'; productId: number; quantity: number }
  | { type: 'remove'; productId: number };

const cartKey = (token: string | null) => ['cart', api.baseURL, token];
const mutationKey = ['cart-write', api.baseURL];
let writing = false;

export function useCart() {
  const session = useSyncExternalStore(cartSession.subscribe, cartSession.getSnapshot);
  const client = useQueryClient();
  const pending = useIsMutating(mutationKey) > 0;
  const query = useQuery(
    cartKey(session.token),
    ({ signal }) => session.token ? cartRequest(session.token, 'GET', '', undefined, signal) : emptyCart,
    { enabled: !pending, retry: false, staleTime: 30_000 },
  );
  const mutation = useMutation(async (action: CartAction) => {
    // The shared lock also covers clicks before React renders the disabled controls.
    if (writing) {throw new Error('Wait for the current cart update to finish.');}
    writing = true;
    try {
      const token = action.type === 'add' ? await ensureCartToken() : cartSession.getSnapshot().token;
      if (!token) {throw new Error('Your cart is no longer available. Add products to start again.');}
      await client.cancelQueries(['cart', api.baseURL]);
      const cart = action.type === 'add'
        ? await cartRequest(token, 'POST', '/items', { productId: action.productId, quantity: action.quantity })
        : action.type === 'update'
          ? await cartRequest(token, 'PATCH', `/items/${action.productId}`, { quantity: action.quantity })
          : await cartRequest(token, 'DELETE', `/items/${action.productId}`);
      client.setQueryData(cartKey(token), cart);
      return cart;
    } finally {
      writing = false;
    }
  }, { mutationKey, retry: false });

  return { ...query, cart: query.data ?? emptyCart, pending, mutation, notice: session.notice };
}
