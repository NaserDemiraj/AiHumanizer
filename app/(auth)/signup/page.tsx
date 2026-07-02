import type { Metadata } from "next";
import AuthForm from "../AuthForm";

export const metadata: Metadata = {
  title: "Create account — HumanFlow",
};

export default function SignupPage() {
  return <AuthForm variant="signup" />;
}
