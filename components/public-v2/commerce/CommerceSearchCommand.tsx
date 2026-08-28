import { marketplaceSearchHref } from "@/lib/public-marketplace/routes";
import { KtIconSearch } from "@/components/public-v2/graphics/KtIcons";
import styles from "./commerce.module.css";

interface CommerceSearchCommandProps {
  action?: string;
  query?: string;
  placeholder?: string;
  hidden?: Array<{ name: string; value: string }>;
  className?: string;
}

export function CommerceSearchCommand({
  action = marketplaceSearchHref(),
  query = "",
  placeholder = "Search products, stores or categories...",
  hidden = [],
  className = "",
}: CommerceSearchCommandProps) {
  return (
    <form
      action={action}
      className={`${styles.searchCommandForm} ${className}`}
      role="search"
    >
      {hidden.map((field) => (
        <input
          key={`${field.name}:${field.value}`}
          name={field.name}
          type="hidden"
          value={field.value}
        />
      ))}
      <label className="sr-only" htmlFor="commerce-search-input">
        Search the marketplace
      </label>
      <input
        aria-label="Search the marketplace"
        className={styles.searchCommandInput}
        defaultValue={query}
        id="commerce-search-input"
        maxLength={160}
        name="q"
        placeholder={placeholder}
        type="search"
      />
      <button
        aria-label="Submit search"
        className={styles.searchCommandButton}
        type="submit"
      >
        <KtIconSearch size={18} />
        <span style={{ marginLeft: 6 }}>Search</span>
      </button>
    </form>
  );
}
