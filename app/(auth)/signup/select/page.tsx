import type { Metadata } from "next";
import Link from "next/link";
import { AuthFlowLinks, AuthRouteIntro } from "@/components/public-v2/auth";
import styles from "@/components/public-v2/auth/auth-pages.module.css";

export const metadata: Metadata = {
  title: "Choose an account type",
  description: "Choose the KT Couriers account type that matches your delivery needs.",
  robots: { index: false, follow: false },
};

export default function AccountTypeSelectPage() {
  return (
    <>
      <AuthRouteIntro eyebrow="New account" title="Choose an account type">
        Select the account that matches how you use KT Couriers.
      </AuthRouteIntro>
      <div className={styles.accountChoices}>
        <Link className={styles.accountChoice} href="/signup?role=customer">
          <span className={styles.accountChoiceTitle}>Customer account</span>
          <span className={styles.accountChoiceText}>Request and follow your deliveries.</span>
        </Link>
        <Link className={styles.accountChoice} href="/signup?role=store">
          <span className={styles.accountChoiceTitle}>Business account</span>
          <span className={styles.accountChoiceText}>Coordinate delivery requests for your store.</span>
        </Link>
      </div>
      <AuthFlowLinks links={[{ href: "/login", label: "Already have an account? Sign in" }]} />
    </>
  );
}
