import Image from "next/image";

const ASSET_ROOT = "/assets/dochi";

const STATIC_POSES = {
  idle: `${ASSET_ROOT}/dochi-idle.png`,
  delivery: `${ASSET_ROOT}/dochi-delivery.png`,
  results: `${ASSET_ROOT}/dochi-present-results.png`,
  point: `${ASSET_ROOT}/dochi-point-up.png`,
  "point-up": `${ASSET_ROOT}/dochi-point-up.png`,
};

const MOTION_POSES = {
  run: [
    `${ASSET_ROOT}/dochi-run-side-a.png`,
    `${ASSET_ROOT}/dochi-run-side-b.png`,
  ],
  back: [
    `${ASSET_ROOT}/dochi-run-back-a.png`,
    `${ASSET_ROOT}/dochi-run-back-b.png`,
  ],
};

export default function DochiSprite({ pose = "idle", direction = "right", className = "" }) {
  const classes = `dochi-sprite is-${pose} is-${direction} ${className}`.trim();
  const frames = MOTION_POSES[pose];

  return <span className={classes} aria-hidden="true">
    {frames ? frames.map((src, index) => <Image
      key={src}
      className={`dochi-sprite__image dochi-sprite__frame dochi-sprite__frame--${index === 0 ? "a" : "b"}`}
      src={src}
      alt=""
      width={512}
      height={512}
      sizes="(max-width: 700px) 124px, 178px"
      draggable="false"
    />) : <Image
      className="dochi-sprite__image"
      src={STATIC_POSES[pose] || STATIC_POSES.idle}
      alt=""
      width={512}
      height={512}
      sizes="(max-width: 700px) 132px, 178px"
      draggable="false"
    />}
  </span>;
}
