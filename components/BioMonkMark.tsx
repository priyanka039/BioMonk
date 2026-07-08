import Image from "next/image";

type BioMonkMarkProps = {
    size?: number;
    className?: string;
};

/** Brand icon from official BioMonk asset (transparent PNG) */
export default function BioMonkMark({ size = 32, className }: BioMonkMarkProps) {
    return (
        <Image
            src="/biomonk-icon.png"
            alt="BioMonk"
            width={size}
            height={size}
            className={className}
            style={{ height: size, width: size, display: "block" }}
        />
    );
}
