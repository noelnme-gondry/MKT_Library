export default function manifest() {
  return {
    name: "Growth Opt Playbook",
    short_name: "Growth Opt",
    description: "퍼포먼스 마케팅 주간 의사결정 워크스페이스",
    start_url: "/",
    display: "standalone",
    background_color: "#0b1018",
    theme_color: "#0b1018",
    icons: [
      { src: "/icons/dochi-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/dochi-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/dochi-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
