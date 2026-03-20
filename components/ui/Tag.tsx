interface TagProps {
    variant?: "green" | "gold" | "red" | "blue" | "muted";
    children: React.ReactNode;
    className?: string;
}

export default function Tag({ variant = "muted", children, className = "" }: TagProps) {
    const cls = `tag tag-${variant} ${className}`;
    return <span className={cls}>{children}</span>;
}
