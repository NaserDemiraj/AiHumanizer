import type { Metadata } from "next";
import AuthForm from "../AuthForm";

export const metadata: Metadata = {
  title: "Sign in — HumanFlow",
};

export default function LoginPage() {
  return <AuthForm variant="login" />;
}
