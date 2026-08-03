# Storefront search

The provider-neutral adapter has deterministic in-memory and PostgreSQL forms.
The latter uses parameterised exact/prefix/ILIKE/trigram candidates over the
projection table—no external SDK or network service. Queries use bounded Unicode
normalisation and exact identifier behaviour. Active reviewed synonyms are
versioned and immutable; equivalent and one-way terms are normalized as bounded
plain data, never SQL, regex, executable rules, misleading brand substitution,
or automatic AI activation.
