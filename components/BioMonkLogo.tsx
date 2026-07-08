import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

const WORDMARK_RATIO = 483 / 95;

export type BioMonkLogoVariant = "full" | "compact" | "mark";
export type BioMonkLogoTone = "on-dark" | "on-light";

type BioMonkLogoProps = {
    variant?: BioMonkLogoVariant;
    tone?: BioMonkLogoTone;
    height?: number;
    priority?: boolean;
    href?: string;
    suffix?: ReactNode;
    className?: string;
    style?: CSSProperties;
};

export default function BioMonkLogo({
    variant = "compact",
    tone = "on-dark",
    height = 32,
    priority = false,
    href,
    suffix,
    className = "",
    style,
}: BioMonkLogoProps) {
    const wordmarkSrc =
        tone === "on-dark" ? "/biomonk-wordmark-light.png" : "/biomonk-wordmark.png";

    const wordmarkHeight =
        variant === "full" ? Math.round(height * 0.85) : height;
    const wordmarkWidth = Math.round(wordmarkHeight * WORDMARK_RATIO);

    const wordmark = (
        <Image
            src={wordmarkSrc}
            alt="BioMonk"
            width={wordmarkWidth}
            height={wordmarkHeight}
            priority={priority}
            className={tone === "on-dark" ? "brand-wordmark-bright" : undefined}
            style={{
                height: wordmarkHeight,
                width: "auto",
                display: "block",
                ...style,
            }}
        />
    );

    const content =
        variant === "mark" ? (
            wordmark
        ) : (
            <span className={`brand-lockup ${className}`.trim()} style={{ lineHeight: 0 }}>
                {wordmark}
                {suffix}
            </span>
        );

    if (href) {
        return (
            <Link href={href} aria-label="BioMonk home" style={{ textDecoration: "none", lineHeight: 0 }}>
                {content}
            </Link>
        );
    }

    return content;
}
