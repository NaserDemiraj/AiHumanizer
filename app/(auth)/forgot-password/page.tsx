import type { Metadata } from "next";
import ForgotPasswordForm from "../ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot password — HumanFlow",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
