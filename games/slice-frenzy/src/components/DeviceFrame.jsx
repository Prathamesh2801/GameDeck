// Mobile-first device frame: full screen on phones, a width-capped phone
// shape centered on desktop. Locked to the dynamic viewport (no page scroll).
const frameBg = {
  backgroundColor: "var(--color-background)",
  backgroundImage:
    "radial-gradient(120% 80% at 50% -10%, rgba(28,85,42,0.16), transparent 60%)," +
    "radial-gradient(100% 60% at 100% 110%, rgba(217,150,31,0.12), transparent 55%)",
};

export default function DeviceFrame({ children }) {
  return (
    <div className="relative flex h-dvh w-full justify-center overflow-hidden sm:items-center sm:py-6">
      <div
        style={frameBg}
        className="relative flex h-full w-full max-w-[460px] flex-col overflow-hidden shadow-[0_30px_90px_-30px_rgba(13,22,17,0.6)] sm:h-[min(100%,860px)] sm:rounded-[2.4rem] sm:ring-1 sm:ring-border-strong/50"
      >
        {children}
      </div>
    </div>
  );
}
