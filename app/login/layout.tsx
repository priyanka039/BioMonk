import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Sign In — BioMonk",
    description: "Sign in to your BioMonk student account to continue your NEET Biology preparation.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return children;
}
