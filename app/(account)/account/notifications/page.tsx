import { OperationalPanel, ProtectedState } from "@/components/protected-v2";
import { CustomerPage } from "@/components/protected-v2/customer/CustomerPresentation";
import { formatCustomerDateTime } from "@/lib/customer-presentation/customer-order-presentation";
import { listCustomerNotifications } from "@/lib/customer-presentation/customer-notifications";
import { getCurrentUser } from "@/lib/auth/current-user";
import styles from "@/components/protected-v2/customer/CustomerPresentation.module.css";

export const metadata = { title: "Notifications" };

export default async function NotificationsInboxPage() {
  const user = await getCurrentUser();
  const notifications = await listCustomerNotifications(user!.id);
  return (
    <CustomerPage eyebrow="Account updates" title="Notifications" description="Delivery and account updates from your canonical inbox.">
      {!notifications.length ? <ProtectedState kind="empty" title="No notifications" description="New account and delivery updates will appear here." /> : <OperationalPanel title="Inbox"><ul className={styles.inbox}>{notifications.map((notification: any) => <li className={`${styles.inboxItem} ${notification.unread ? styles.inboxUnread : ""}`} key={notification.id}><h2>{notification.title}</h2><p>{notification.body}</p><time>{formatCustomerDateTime(notification.createdAt) ?? "—"}</time></li>)}</ul></OperationalPanel>}
    </CustomerPage>
  );
}
