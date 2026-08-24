import { Link } from "react-router-dom";
import { ChevronRightIcon } from "./Icons.jsx";

/** props: items -- [{ label, to? }], last item is treated as the current
 * page (rendered plain, no link) even if it has a `to`. */
export default function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center flex-wrap gap-1 text-xs text-ink/60 mb-4">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={item.label} className="flex items-center gap-1">
            {index > 0 && <ChevronRightIcon className="w-3 h-3 text-ink/30" />}
            {isLast || !item.to ? (
              <span className={isLast ? "text-ink font-medium" : ""}>{item.label}</span>
            ) : (
              <Link to={item.to} className="hover:text-ink transition-colors">
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
