import type { Metadata } from "next";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Set a new password",
  description: "Set a new password for your KT Couriers account.",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;
  const hasResetToken = Boolean(token);

  return (
    <>
      {hasResetToken ? (
        <input form="reset-password-form" name="token" type="hidden" value={token} />
      ) : null}
      <ResetPasswordForm hasResetToken={hasResetToken} />
    </>
  );
}
