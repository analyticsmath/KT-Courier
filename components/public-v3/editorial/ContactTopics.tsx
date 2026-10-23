"use client";
import styles from "./editorial-pages.module.css";
const topics = [
  {
    title: "A delivery question.",
    copy: "A new parcel, a route you’re considering or a handling detail you’d like to talk through.",
    value: "delivery_question",
    action: "Ask about a delivery",
  },
  {
    title: "Your next business move.",
    copy: "Repeat deliveries, a store account or coordinating the requests behind your business.",
    value: "business_account",
    action: "Talk about your business",
  },
  {
    title: "Something already moving.",
    copy: "Include your order reference and the question you need help with. Keep personal details to what’s necessary.",
    value: "existing_order",
    action: "Get help with an order",
  },
];
export function ContactTopics() {
  return (
    <section
      className={styles.contactChoices}
      data-chapter-takeover
      data-section-transition="open"
    >
      <h2 data-split-heading>
        Let’s start with
        <br />
        what you need.
      </h2>
      <div className={styles.topics}>
        {topics.map((topic) => (
          <div className={styles.topic} key={topic.value}>
            <h3>{topic.title}</h3>
            <p>{topic.copy}</p>
            <a
              href="#contact-form"
              className="kt-text-link"
              onClick={() => {
                const select = document.querySelector<HTMLSelectElement>(
                  '#contact-form select[name="enquiry_type"]',
                );
                if (select) select.value = topic.value;
              }}
            >
              {topic.action} ↗
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
