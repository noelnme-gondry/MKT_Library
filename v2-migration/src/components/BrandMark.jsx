import Image from "next/image";

// Growth Opt Playbook brand mark — shared by the app shell and analysis dock.
export default function BrandMark({ size = 28, className = "brand-mark", label = "" }) {
  return (
    <span
      className={className}
      style={{ width: size, height: size }}
      aria-hidden={label ? undefined : true}
    >
      <Image
        src="/favicon.svg"
        alt={label}
        width={size}
        height={size}
        className="brand-mark__image"
        unoptimized
      />
    </span>
  );
}
