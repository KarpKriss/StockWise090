export default function Card({ children, style, ...props }) {
  return (
    <div
      {...props}
      className={`app-card ${props.className || ""}`.trim()}
      style={style}
    >
      {children}
    </div>
  );
}
