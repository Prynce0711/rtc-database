// color must use daisyUI badge colors (primary, secondary, accent, info, success, warning, error) eg: <BaseBadge color="badge-primary" text="Primary" />
const BaseBadge = ({ color, text }: { color: string; text: string }) => {
  return <div className={`badge ${color}`}>{text}</div>;
};

export default BaseBadge;
