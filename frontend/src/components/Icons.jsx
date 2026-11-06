/** Site-wide icon set: Simple Line Icons (https://thesabbir.github.io/simple-line-icons/,
 * MIT), via react-icons/sl -- only the icons imported here are bundled.
 *
 * Every export keeps the name the rest of the app already uses, so pages
 * don't import react-icons directly; swap a mapping here to change an icon
 * everywhere. Size with Tailwind classes (default w-4 h-4); colour follows
 * `currentColor`.
 *
 * Simple Line has no TikTok, eye-off or filled heart: TikTok and eye-off are
 * drawn below in a matching thin stroke; the "saved" heart is the same line
 * heart, shown on a filled background by the caller (see ProductCard). */
import {
  SlArrowLeft,
  SlArrowRight,
  SlBag,
  SlBasket,
  SlCheck,
  SlClose,
  SlDirections,
  SlDrawer,
  SlDrop,
  SlEnvolope,
  SlExclamation,
  SlEye,
  SlGraph,
  SlGrid,
  SlHeart,
  SlHome,
  SlLayers,
  SlList,
  SlLocationPin,
  SlLock,
  SlLogout,
  SlMagicWand,
  SlMenu,
  SlMinus,
  SlNote,
  SlPeople,
  SlPhone,
  SlPicture,
  SlPlus,
  SlSocialFacebook,
  SlSocialInstagram,
  SlTag,
  SlTarget,
  SlTrash,
  SlUser,
} from "react-icons/sl";

const sl = (Component) =>
  function SimpleLineIcon({ className = "w-4 h-4", ...rest }) {
    return <Component className={className} aria-hidden="true" focusable="false" {...rest} />;
  };

// Custom glyphs for the three Simple Line gaps: same 1px-at-24px stroke feel.
function Thin({ children, className = "w-4 h-4" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

// ---------- Storefront / forms ----------
export const MailIcon = sl(SlEnvolope);
export const LockIcon = sl(SlLock);
export const UserIcon = sl(SlUser);
export const PhoneIcon = sl(SlPhone);
export const EyeIcon = sl(SlEye);
export const MapPinIcon = sl(SlLocationPin);
export const BagIcon = sl(SlBag);
export const PlusIcon = sl(SlPlus);
export const MinusIcon = sl(SlMinus);
export const TrashIcon = sl(SlTrash);
export const CheckIcon = sl(SlCheck);
export const HeartIcon = sl(SlHeart);
export const HeartFilledIcon = sl(SlHeart);
export const InstagramIcon = sl(SlSocialInstagram);
export const FacebookIcon = sl(SlSocialFacebook);
export const ChevronRightIcon = sl(SlArrowRight);
export const ChevronLeftIcon = sl(SlArrowLeft);
export const HomeIcon = sl(SlHome);
export const ShopIcon = sl(SlBasket);
export const QuizIcon = sl(SlMagicWand);

export function EyeOffIcon(props) {
  return (
    <Thin {...props}>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a13.3 13.3 0 0 1-3.1 4M6.6 6.6C4.3 8.2 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 4.4-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </Thin>
  );
}

export function TiktokIcon(props) {
  return (
    <Thin {...props}>
      <path d="M14 3v10.5a2.5 2.5 0 1 1-2-2.45" />
      <path d="M14 3a5 5 0 0 0 5 5" />
    </Thin>
  );
}

// ---------- Admin navigation & dashboard ----------
export const GridIcon = sl(SlGrid);
export const ReceiptIcon = sl(SlNote);
export const BoxIcon = sl(SlDrawer);
export const LayersIcon = sl(SlLayers);
export const StepsIcon = sl(SlList);
export const DirectionsIcon = sl(SlDirections);
export const TagIcon = sl(SlTag);
export const ImageIcon = sl(SlPicture);
export const TargetIcon = sl(SlTarget);
export const DropletIcon = sl(SlDrop);
export const UsersIcon = sl(SlPeople);
export const StoreIcon = sl(SlHome);
export const LogOutIcon = sl(SlLogout);
export const MenuIcon = sl(SlMenu);
export const XIcon = sl(SlClose);
export const TrendIcon = sl(SlGraph);
export const AlertIcon = sl(SlExclamation);
