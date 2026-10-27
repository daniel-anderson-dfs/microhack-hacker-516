import { createHash, randomBytes } from 'node:crypto';
import { DatabaseConnection, getDatabase } from '../db/sqlite';
import { Cart } from '../models/cart';
import { DatabaseError, NotFoundError, ValidationError } from '../utils/errors';

interface CartRow {
  product_id: number;
  name: string;
  sku: string;
  img_name: string | null;
  quantity: number;
  price: number;
  discount: number | null;
}

export function validateQuantity(quantity: unknown): asserts quantity is number {
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
    throw new ValidationError('Quantity must be an integer from 1 to 999');
  }
}

export function validateProductId(id: unknown): asserts id is number {
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) {
    throw new ValidationError('Product ID must be a positive integer');
  }
}

export class CartsRepository {
  constructor(private readonly connection: DatabaseConnection) {}

  create(): { token: string; cart: Cart } {
    const token = randomBytes(32).toString('hex');
    this.connection.db.prepare('INSERT INTO carts (token_hash) VALUES (?)').run(this.hash(token));
    return { token, cart: { items: [], itemCount: 0, totalCents: 0 } };
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private cartId(token: string): number {
    const row = /^[a-f0-9]{64}$/.test(token)
      ? this.connection.db.prepare('SELECT cart_id FROM carts WHERE token_hash = ?')
        .get(this.hash(token)) as { cart_id: number } | undefined
      : undefined;
    if (!row) {
      throw new DatabaseError('Cart credentials are missing or invalid', 'INVALID_CART_TOKEN', 401);
    }
    return row.cart_id;
  }

  get(token: string): Cart {
    return this.read(this.cartId(token));
  }

  private read(cartId: number): Cart {
    const rows = this.connection.db.prepare(`
      SELECT p.product_id, p.name, p.sku, p.img_name, p.price, p.discount, ci.quantity
      FROM cart_items ci JOIN products p ON p.product_id = ci.product_id
      WHERE ci.cart_id = ? ORDER BY p.product_id
    `).all(cartId) as CartRow[];
    const items = rows.map((row) => {
      const discount = row.discount ?? 0;
      if (!Number.isFinite(row.price) || row.price < 0 ||
          !Number.isFinite(discount) || discount < 0 || discount > 1) {
        throw new ValidationError('A product has an invalid catalogue price or discount');
      }
      const priceCents = Math.round(row.price * 100);
      const unitPriceCents = Math.round(priceCents * (1 - discount));
      const lineTotalCents = unitPriceCents * row.quantity;
      if (![priceCents, unitPriceCents, lineTotalCents].every(Number.isSafeInteger)) {
        throw new ValidationError('Cart price exceeds the supported range');
      }
      return {
        productId: row.product_id, name: row.name, sku: row.sku, imgName: row.img_name,
        quantity: row.quantity, unitPriceCents, lineTotalCents,
      };
    });
    const totalCents = items.reduce((total, item) => total + item.lineTotalCents, 0);
    const itemCount = items.reduce((total, item) => total + item.quantity, 0);
    if (!Number.isSafeInteger(totalCents) || !Number.isSafeInteger(itemCount)) {
      throw new ValidationError('Cart total exceeds the supported range');
    }
    return { items, itemCount, totalCents };
  }

  add(token: string, productId: number, quantity: number): Cart {
    validateProductId(productId);
    validateQuantity(quantity);
    return this.connection.db.transaction(() => {
      const cartId = this.cartId(token);
      if (!this.connection.db.prepare('SELECT 1 FROM products WHERE product_id = ?').get(productId)) {
        throw new NotFoundError('Product', productId);
      }
      const result = this.connection.db.prepare(`
        INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)
        ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = cart_items.quantity + excluded.quantity
        WHERE cart_items.quantity + excluded.quantity <= 999
      `).run(cartId, productId, quantity);
      if (!result.changes) throw new ValidationError('Combined quantity cannot exceed 999');
      return this.read(cartId);
    })();
  }

  update(token: string, productId: number, quantity: number): Cart {
    validateProductId(productId);
    validateQuantity(quantity);
    return this.connection.db.transaction(() => {
      const cartId = this.cartId(token);
      const result = this.connection.db.prepare(
        'UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?',
      ).run(quantity, cartId, productId);
      if (!result.changes) throw new NotFoundError('Cart item', productId);
      return this.read(cartId);
    })();
  }

  remove(token: string, productId: number): Cart {
    validateProductId(productId);
    return this.connection.db.transaction(() => {
      const cartId = this.cartId(token);
      const result = this.connection.db.prepare(
        'DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?',
      ).run(cartId, productId);
      if (!result.changes) throw new NotFoundError('Cart item', productId);
      return this.read(cartId);
    })();
  }
}

export async function getCartsRepository(): Promise<CartsRepository> {
  return new CartsRepository(await getDatabase());
}
