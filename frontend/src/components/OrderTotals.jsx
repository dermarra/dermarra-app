/** Subtotal / discount / shipping / total for an order -- shared by the
 * customer and admin order-detail pages. Without the discount row, a coupon
 * order's line items didn't add up to its total. */
export default function OrderTotals({ order }) {
  const money = (cents) => `${order.currency} ${(cents / 100).toFixed(0)}`;
  return (
    <div className="mt-3 pt-3 border-t border-mist flex flex-col gap-1 text-sm">
      <div className="flex justify-between text-ink/70">
        <span>Subtotal</span>
        <span>{money(order.subtotal_cents)}</span>
      </div>
      {order.discount_cents > 0 && (
        <div className="flex justify-between text-lime-800">
          <span>Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}</span>
          <span>- {money(order.discount_cents)}</span>
        </div>
      )}
      {order.shipping_cents > 0 && (
        <div className="flex justify-between text-ink/70">
          <span>Shipping</span>
          <span>{money(order.shipping_cents)}</span>
        </div>
      )}
      <div className="flex justify-between font-semibold text-ink">
        <span>Total</span>
        <span>{money(order.total_cents)}</span>
      </div>
    </div>
  );
}
