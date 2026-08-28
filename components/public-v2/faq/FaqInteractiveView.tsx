"use client";

import { useState } from "react";
import Link from "next/link";
import { publicFaqSections } from "@/lib/public-faq/faqs";
import styles from "./faq-page.module.css";

export function FaqInteractiveView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");

  const filteredSections = publicFaqSections
    .filter((section) => selectedTopic === "all" || section.id === selectedTopic)
    .map((section) => {
      const items = section.items.filter(
        (item) =>
          !searchQuery.trim() ||
          item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.answer.toLowerCase().includes(searchQuery.toLowerCase())
      );
      return { ...section, items };
    })
    .filter((section) => section.items.length > 0);

  return (
    <div className={styles.faqInteractiveContainer}>
      {/* Search Input */}
      <div className={styles.searchBarWrap}>
        <input
          aria-label="Search FAQ questions"
          className={styles.searchInput}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search questions or topics..."
          type="search"
          value={searchQuery}
        />
      </div>

      {/* Topic Filter Tabs */}
      <div className={styles.topicsRow}>
        <button
          className={`${styles.topicButton} ${
            selectedTopic === "all" ? styles.topicButtonActive : ""
          }`}
          onClick={() => setSelectedTopic("all")}
          type="button"
        >
          All Topics
        </button>
        {publicFaqSections.map((section) => (
          <button
            className={`${styles.topicButton} ${
              selectedTopic === section.id ? styles.topicButtonActive : ""
            }`}
            key={section.id}
            onClick={() => setSelectedTopic(section.id)}
            type="button"
          >
            {section.title}
          </button>
        ))}
      </div>

      {/* Filtered FAQ Result Stream */}
      <div className={styles.faqContentStream}>
        {filteredSections.length === 0 ? (
          <div className={styles.noResultsCard}>
            <p>No questions matched your search &quot;{searchQuery}&quot;.</p>
            <button
              className={styles.clearSearchButton}
              onClick={() => {
                setSearchQuery("");
                setSelectedTopic("all");
              }}
              type="button"
            >
              Clear search filter
            </button>
          </div>
        ) : (
          filteredSections.map((section) => (
            <section className={styles.faqSection} id={section.id} key={section.id}>
              <h2 className={styles.faqSectionHeading}>{section.title}</h2>
              <div className={styles.faqItemList}>
                {section.items.map((item) => (
                  <details className={styles.faqItemDetails} key={item.question}>
                    <summary>{item.question}</summary>
                    <div className={styles.faqAnswer}>
                      <p>{item.answer}</p>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {/* Support Help Block */}
      <section aria-labelledby="help-title" className={styles.helpBlock}>
        <h2 className={styles.helpTitle} id="help-title">
          Still have a question?
        </h2>
        <p className={styles.helpText}>
          Our team is available to assist with custom logistics requests, merchant integrations, or active order enquiries.
        </p>
        <Link className={styles.helpAction} href="/contact">
          Contact Support &rarr;
        </Link>
      </section>
    </div>
  );
}
