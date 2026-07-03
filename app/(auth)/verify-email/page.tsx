import type { Metadata } from "next";
import { Suspense } from "react";
import VerifyEmailStatus from "../VerifyEmailStatus";

export const metadata: Metadata = {
  title: "Verify email — HumanFlow",
};

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailStatus />
    </Suspense>
  );
}
