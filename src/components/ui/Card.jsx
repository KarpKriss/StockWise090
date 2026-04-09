export default function Card({ children, style, ...props }) {
  return (
    <div
      {...props}
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#fff",
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
