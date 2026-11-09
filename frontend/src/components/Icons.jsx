/** Site-wide icon set -- **only** Simple Line Icons, everywhere (owner,
 * 2026-11-09; no other icon packs, hand-drawn SVG icons or arrow/check
 * characters standing in for icons). Simple Line Icons (https://thesabbir.github.io/simple-line-icons/,
 * MIT), via react-icons/sl -- only the icons imported here are bundled.
 *
 * Every export keeps the name the rest of the app already uses, so pages
 * don't import react-icons directly; swap a mapping here to change an icon
 * everywhere. Size with Tailwind classes (default w-4 h-4); colour follows
 * `currentColor`.
 *
 * Simple Line has no TikTok, eye-off or filled heart, so those map to the
 * closest Simple Line icon (see below); the "saved" heart is the same line
 * heart on a filled background (see ProductCard). */
import {
  SlArrowDown,
  SlArrowLeft,
  SlArrowRight,
  SlArrowUp,
  SlBadge,
  SlBookOpen,
  SlBag,
  SlBasket,
  SlCheck,
  SlChemistry,
  SlClock,
  SlClose,
  SlCompass,
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
  SlMusicTone,
  SlLogout,
  SlMagicWand,
  SlMagnifier,
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
export const ChevronDownIcon = sl(SlArrowDown);
export const ChevronUpIcon = sl(SlArrowUp);
export const HomeIcon = sl(SlHome);
export const ShopIcon = sl(SlBasket);
export const QuizIcon = sl(SlMagicWand);
export const SearchIcon = sl(SlMagnifier);
export const CompassIcon = sl(SlCompass);
export const ClockIcon = sl(SlClock);
export const BookIcon = sl(SlBookOpen);
export const ChemistryIcon = sl(SlChemistry);
export const BadgeIcon = sl(SlBadge);

// Simple Line has no eye-off or TikTok: "hide password" is the lock, and
// TikTok is the music note its own logo is built from.
export const EyeOffIcon = sl(SlLock);
export const TiktokIcon = sl(SlMusicTone);
export const ArrowRightIcon = sl(SlArrowRight);
export const ArrowLeftIcon = sl(SlArrowLeft);
export const ListIcon = sl(SlList);

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
