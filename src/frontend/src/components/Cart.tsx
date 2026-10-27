import { FormEvent, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CartItem, cartErrorMessage, formatCartMoney } from '../api/cart';
import { useCart } from '../context/useCart';
import { useTheme } from '../context/ThemeContext';

const control = 'rounded-md border border-gray-500 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50';

function QuantityForm({ item, pending, update }: {
  item: CartItem; pending: boolean; update: (quantity: number) => Promise<void>;
}) {
  const [quantity, setQuantity] = useState(String(item.quantity));
  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = Number(quantity);
    if (!Number.isInteger(value) || value < 1 || value > 999) {return;}
    await update(value);
    setQuantity(String(item.quantity));
  }
  return (
    <form onSubmit={(event) => { void submit(event); }} className="flex flex-wrap items-end gap-2">
      <label className="text-sm">
        Quantity <span className="sr-only">of {item.name}</span>
        <input type="number" min="1" max="999" step="1" required value={quantity}
          onChange={(event) => setQuantity(event.target.value)} disabled={pending}
          className={`${control} ml-2 w-20 bg-transparent`} />
      </label>
      <button className={control} disabled={pending || Number(quantity) === item.quantity}>Update</button>
    </form>
  );
}

export default function Cart() {
  const { cart, pending, mutation, isLoading, isError, error, refetch, notice } = useCart();
  const { darkMode } = useTheme();
  const [message, setMessage] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';

  async function update(productId: number, quantity: number) {
    setMessage('');
    try {
      await mutation.mutateAsync({ type: 'update', productId, quantity });
      setMessage('Quantity updated.');
    } catch { /* The mutation error is rendered below. */ }
  }

  async function remove(productId: number) {
    setMessage('');
    try {
      await mutation.mutateAsync({ type: 'remove', productId });
      setMessage('Item removed.');
      heading.current?.focus();
    } catch { /* The mutation error is rendered below. */ }
  }

  return (
    <section className={`min-h-screen px-4 pt-24 pb-16 ${darkMode ? 'text-light' : 'text-gray-800'}`}>
      <div className="max-w-7xl mx-auto">
        <h1 ref={heading} tabIndex={-1} className="text-3xl font-bold mb-2">Your cart</h1>
        <p className="mb-6">Review your supplies and quantities before continuing to browse.</p>
        <p role="status" className="mb-4">{notice || message}</p>
        {mutation.isError && <p role="alert" className="mb-4">{cartErrorMessage(mutation.error)}</p>}
        {isLoading && <p role="status">Loading your cart...</p>}
        {isError && (
          <div role="alert" className="mb-4">
            <p>{cartErrorMessage(error)}</p>
            <button onClick={() => { void refetch(); }} className={`${control} mt-2`}>Retry loading cart</button>
          </div>
        )}
        {!isLoading && !isError && cart.items.length === 0 && (
          <div className={`${panel} border rounded-lg p-8`}>
            <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
            <Link to="/products" className="underline focus-visible:outline-primary">Browse products</Link>
          </div>
        )}
        {cart.items.length > 0 && (
          <div className="grid lg:grid-cols-[minmax(0,1fr)_18rem] gap-6">
            <ul className="space-y-4" aria-label="Cart items">
              {cart.items.map((item) => (
                <li key={item.productId} className={`${panel} border rounded-lg p-4 flex flex-wrap gap-4`}>
                  {item.imgName && <img src={`/${item.imgName}`} alt="" width={80} height={80} className="w-20 h-20 object-contain" />}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-semibold break-words">{item.name}</h2>
                    <p className="text-sm mb-2">SKU {item.sku}</p>
                    <p className="tabular-nums mb-3">{formatCartMoney(item.unitPriceCents)} each</p>
                    <QuantityForm key={`${item.productId}-${item.quantity}`} item={item} pending={pending}
                      update={(quantity) => update(item.productId, quantity)} />
                    <button onClick={() => { void remove(item.productId); }} disabled={pending}
                      aria-label={`Remove ${item.name}`} className={`${control} mt-3`}>Remove</button>
                  </div>
                  <p className="font-semibold tabular-nums" aria-label={`Line total for ${item.name}`}>
                    {formatCartMoney(item.lineTotalCents)}
                  </p>
                </li>
              ))}
            </ul>
            <aside className={`${panel} border rounded-lg p-6 self-start`} aria-label="Cart summary">
              <h2 className="text-xl font-semibold mb-4">Supply summary</h2>
              <p>{cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'}</p>
              <div className="border-t border-gray-500 mt-4 pt-4 flex justify-between font-bold">
                <span>Total</span><span data-testid="cart-total" className="tabular-nums">{formatCartMoney(cart.totalCents)}</span>
              </div>
              <p className="text-sm my-4">Current product discounts included. Checkout is not available yet.</p>
              <Link to="/products" className="underline focus-visible:outline-primary">Continue shopping</Link>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
