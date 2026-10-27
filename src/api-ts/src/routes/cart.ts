import express from 'express';
import { getCartsRepository, validateProductId, validateQuantity } from '../repositories/cartsRepo';
import { ValidationError } from '../utils/errors';

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     GuestCart:
 *       type: http
 *       scheme: bearer
 *       description: Guest cart token returned once at creation. Not a user login.
 *   schemas:
 *     Cart:
 *       type: object
 *       required: [items, itemCount, totalCents]
 *       properties:
 *         itemCount: { type: integer, description: Total units }
 *         totalCents: { type: integer, description: Sum of discounted line totals in USD cents }
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             required: [productId, name, sku, imgName, quantity, unitPriceCents, lineTotalCents]
 *             properties:
 *               productId: { type: integer }
 *               name: { type: string }
 *               sku: { type: string }
 *               imgName: { type: string, nullable: true }
 *               quantity: { type: integer, minimum: 1, maximum: 999 }
 *               unitPriceCents: { type: integer, description: Current discounted unit price rounded to cents }
 *               lineTotalCents: { type: integer }
 *   responses:
 *     Cart:
 *       description: Current API-persisted cart
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Cart'
 *     InvalidCartInput:
 *       description: Invalid request or quantity outside 1..999 (including accumulated quantity)
 *     InvalidCartToken:
 *       description: Missing or invalid guest cart bearer token
 *     MissingCartItem:
 *       description: Product or cart item does not exist
 *   parameters:
 *     CartProductId:
 *       in: path
 *       name: productId
 *       required: true
 *       schema: { type: integer, minimum: 1 }
 * /api/carts:
 *   post:
 *     tags: [Cart]
 *     summary: Create a guest cart
 *     responses:
 *       201:
 *         description: Save this token to access the cart again
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 cart:
 *                   $ref: '#/components/schemas/Cart'
 * /api/cart:
 *   get:
 *     tags: [Cart]
 *     summary: Read the guest cart with current catalogue prices
 *     security: [{ GuestCart: [] }]
 *     responses:
 *       200: { $ref: '#/components/responses/Cart' }
 *       401: { $ref: '#/components/responses/InvalidCartToken' }
 *       400: { $ref: '#/components/responses/InvalidCartInput' }
 * /api/cart/items:
 *   post:
 *     tags: [Cart]
 *     summary: Add units to a product in the cart
 *     security: [{ GuestCart: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [productId, quantity]
 *             properties:
 *               productId: { type: integer, minimum: 1 }
 *               quantity: { type: integer, minimum: 1, maximum: 999 }
 *     responses:
 *       200: { $ref: '#/components/responses/Cart' }
 *       400: { $ref: '#/components/responses/InvalidCartInput' }
 *       401: { $ref: '#/components/responses/InvalidCartToken' }
 *       404: { $ref: '#/components/responses/MissingCartItem' }
 * /api/cart/items/{productId}:
 *   patch:
 *     tags: [Cart]
 *     summary: Replace a cart item's quantity
 *     security: [{ GuestCart: [] }]
 *     parameters: [{ $ref: '#/components/parameters/CartProductId' }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [quantity]
 *             properties:
 *               quantity: { type: integer, minimum: 1, maximum: 999 }
 *     responses:
 *       200: { $ref: '#/components/responses/Cart' }
 *       400: { $ref: '#/components/responses/InvalidCartInput' }
 *       401: { $ref: '#/components/responses/InvalidCartToken' }
 *       404: { $ref: '#/components/responses/MissingCartItem' }
 *   delete:
 *     tags: [Cart]
 *     summary: Remove a product from the cart
 *     security: [{ GuestCart: [] }]
 *     parameters: [{ $ref: '#/components/parameters/CartProductId' }]
 *     responses:
 *       200: { $ref: '#/components/responses/Cart' }
 *       400: { $ref: '#/components/responses/InvalidCartInput' }
 *       401: { $ref: '#/components/responses/InvalidCartToken' }
 *       404: { $ref: '#/components/responses/MissingCartItem' }
 */

const router = express.Router();

function bodyFields(body: unknown, fields: string[]): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== fields.length || Object.keys(body).some((key) => !fields.includes(key))) {
    throw new ValidationError(`Request must contain only ${fields.join(', ')}`);
  }
  return body as Record<string, unknown>;
}

function token(req: express.Request): string {
  return /^Bearer ([a-f0-9]{64})$/i.exec(req.get('Authorization') ?? '')?.[1] ?? '';
}

router.use(['/cart', '/carts'], (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

router.post('/carts', async (_req, res, next) => {
  try {
    res.status(201).json((await getCartsRepository()).create());
  } catch (error) { next(error); }
});

router.get('/cart', async (req, res, next) => {
  try {
    res.json((await getCartsRepository()).get(token(req)));
  } catch (error) { next(error); }
});

router.post('/cart/items', async (req, res, next) => {
  try {
    const body = bodyFields(req.body, ['productId', 'quantity']);
    validateProductId(body.productId);
    validateQuantity(body.quantity);
    res.json((await getCartsRepository()).add(token(req), body.productId, body.quantity));
  } catch (error) { next(error); }
});

router.patch('/cart/items/:productId', async (req, res, next) => {
  try {
    const body = bodyFields(req.body, ['quantity']);
    const productId = /^\d+$/.test(req.params.productId) ? Number(req.params.productId) : NaN;
    validateQuantity(body.quantity);
    res.json((await getCartsRepository()).update(token(req), productId, body.quantity));
  } catch (error) { next(error); }
});

router.delete('/cart/items/:productId', async (req, res, next) => {
  try {
    const productId = /^\d+$/.test(req.params.productId) ? Number(req.params.productId) : NaN;
    res.json((await getCartsRepository()).remove(token(req), productId));
  } catch (error) { next(error); }
});

export default router;
