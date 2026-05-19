export default function SwapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-black">
      {/* Background image at the top */}
      <div
        className="absolute inset-x-0 top-0 h-[600px] pointer-events-none bg-no-repeat bg-top bg-cover"
        style={{ backgroundImage: "url('/background.png')" }}
      >
        <div className="absolute inset-x-0 bottom-0 h-[200px] bg-gradient-to-b from-transparent to-black" />
      </div>

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
