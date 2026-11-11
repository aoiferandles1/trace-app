import type { Metadata } from "next";
import { Welcome } from "./_components/Welcome";

export const metadata: Metadata = {
  title: { absolute: "Trace · Your health record, owned by you" },
};

/** Welcome (p-splash, p-login). */
export default function WelcomePage() {
  return <Welcome />;
}
