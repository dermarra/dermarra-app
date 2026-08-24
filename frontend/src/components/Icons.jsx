/** Small inline icon set for the auth/account forms, matching BottomNav.jsx's
 * feather-style convention (24x24 viewBox, stroke currentColor). */

function Icon({ children, className = "w-4 h-4" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export function MailIcon(props) {
  return (
    <Icon {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 6 10 7 10-7" />
    </Icon>
  );
}

export function LockIcon(props) {
  return (
    <Icon {...props}>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </Icon>
  );
}

export function UserIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" />
    </Icon>
  );
}

export function PhoneIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L14 13l5 2v4a1 1 0 0 1-1 1C10 20 4 14 3 6a1 1 0 0 1 1-1Z" />
    </Icon>
  );
}

export function EyeIcon(props) {
  return (
    <Icon {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

export function MapPinIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </Icon>
  );
}

export function BagIcon(props) {
  return (
    <Icon {...props}>
      <path d="M6 8h12l1 13H5L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </Icon>
  );
}

export function PlusIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function MinusIcon(props) {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
    </Icon>
  );
}

export function TrashIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
    </Icon>
  );
}

export function CheckIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 12l5 5L20 6" />
    </Icon>
  );
}

export function EyeOffIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a13.3 13.3 0 0 1-3.1 4M6.6 6.6C4.3 8.2 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 4.4-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </Icon>
  );
}

export function HeartIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 21s-7.5-4.6-10-9.3C.4 8.3 2 5 5.4 5c2 0 3.4 1.1 4.1 2.3.4.7.6 1 .5 1 -.1 0 .1-.3.5-1C11.2 6.1 12.6 5 14.6 5 18 5 19.6 8.3 22 11.7 19.5 16.4 12 21 12 21Z" />
    </Icon>
  );
}

export function HeartFilledIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={props.className || "w-4 h-4"}>
      <path d="M12 21s-7.5-4.6-10-9.3C.4 8.3 2 5 5.4 5c2 0 3.4 1.1 4.1 2.3.4.7.6 1 .5 1 -.1 0 .1-.3.5-1C11.2 6.1 12.6 5 14.6 5 18 5 19.6 8.3 22 11.7 19.5 16.4 12 21 12 21Z" />
    </svg>
  );
}

export function InstagramIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function FacebookIcon(props) {
  return (
    <Icon {...props}>
      <path d="M15 8h2V4h-2a4 4 0 0 0-4 4v2H9v4h2v6h4v-6h2.5l.5-4H15V8Z" />
    </Icon>
  );
}

export function TiktokIcon(props) {
  return (
    <Icon {...props}>
      <path d="M14 3v10.5a2.5 2.5 0 1 1-2-2.45" />
      <path d="M14 3a5 5 0 0 0 5 5" />
    </Icon>
  );
}

export function ChevronRightIcon(props) {
  return (
    <Icon {...props}>
      <path d="m9 6 6 6-6 6" />
    </Icon>
  );
}

export function ChevronLeftIcon(props) {
  return (
    <Icon {...props}>
      <path d="m15 6-6 6 6 6" />
    </Icon>
  );
}
