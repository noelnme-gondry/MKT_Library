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

// `priority`는 화면에 곧바로 보이는 자리에서만 켠다. next/image의 기본값은
// `loading="lazy"`라 브라우저가 레이아웃 이후에야 요청을 시작하고 preload 링크도
// 없다 — 말풍선(HTML·CSS)은 즉시 뜨는데 도치만 한참 뒤 나타나는 이유가 이것이다.
export default function DochiSprite({ pose = "idle", direction = "right", className = "", priority = false }) {
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
      priority={priority}
      draggable="false"
    />) : <Image
      className="dochi-sprite__image"
      src={STATIC_POSES[pose] || STATIC_POSES.idle}
      alt=""
      width={512}
      height={512}
      sizes="(max-width: 700px) 132px, 178px"
      priority={priority}
      draggable="false"
    />}
  </span>;
}
