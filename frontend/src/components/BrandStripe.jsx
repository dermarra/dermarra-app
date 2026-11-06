/** Four solid blocks of the brand colours, in the logo's petal order --
 * a brand flourish used on the navbar, footer and admin chrome. Solid
 * segments only: the brand system uses no gradients. */
export default function BrandStripe({ className = "h-1" }) {
  return (
    <div aria-hidden="true" className={`grid grid-cols-4 ${className}`}>
      <span className="bg-lime" />
      <span className="bg-orange" />
      <span className="bg-blue" />
      <span className="bg-gold" />
    </div>
  );
}
