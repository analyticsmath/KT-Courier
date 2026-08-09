-- Gate 3 residual index alignment: authoritative Prisma @@index declarations only.
-- This migration is additive. It neither changes financial/audit data nor removes
-- any historical index. Each specification is checked against pg_catalog before
-- creation so a differently named equivalent is retained rather than duplicated.

DO $$
DECLARE
  spec record;
  table_oid oid;
  table_namespace oid;
  named_index_oid oid;
  equivalent_index_name text;
  expected_attnums smallint[];
  expected_opclasses oid[];
  expected_collations oid[];
  expected_options smallint[];
  expected_columns_sql text;
  btree_method_oid oid;
BEGIN
  SELECT oid INTO STRICT btree_method_oid FROM pg_am WHERE amname = 'btree';

  FOR spec IN
    SELECT *
    FROM (
      VALUES
        ('CatalogDuplicateCandidate', 'CatalogDuplicateCandidate_candidateProductId_idx', ARRAY['candidateProductId']::text[]),
        ('CatalogImportJob', 'CatalogImportJob_storeId_status_createdAt_idx', ARRAY['storeId', 'status', 'createdAt']::text[]),
        ('CatalogImportRow', 'CatalogImportRow_jobId_status_idx', ARRAY['jobId', 'status']::text[]),
        ('CatalogImportRow', 'CatalogImportRow_resultingProductId_idx', ARRAY['resultingProductId']::text[]),
        ('CatalogImportRow', 'CatalogImportRow_resultingOfferId_idx', ARRAY['resultingOfferId']::text[]),
        ('CatalogInventoryItem', 'CatalogInventoryItem_variantId_idx', ARRAY['variantId']::text[]),
        ('CatalogInventoryItem', 'CatalogInventoryItem_trackingMode_idx', ARRAY['trackingMode']::text[]),
        ('CatalogInventoryLevel', 'CatalogInventoryLevel_locationId_idx', ARRAY['locationId']::text[])
    ) AS residual_index(table_name, index_name, column_names)
  LOOP
    SELECT table_class.oid, table_class.relnamespace
      INTO table_oid, table_namespace
    FROM pg_class AS table_class
    WHERE table_class.oid = to_regclass(format('%I', spec.table_name))
      AND table_class.relkind IN ('r', 'p');

    IF table_oid IS NULL THEN
      RAISE EXCEPTION 'Residual index alignment blocked: required table % is missing.', spec.table_name;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM unnest(spec.column_names) WITH ORDINALITY AS requested(column_name, position)
      LEFT JOIN pg_attribute AS attribute
        ON attribute.attrelid = table_oid
       AND attribute.attname = requested.column_name
       AND attribute.attnum > 0
       AND NOT attribute.attisdropped
      WHERE attribute.attnum IS NULL
    ) THEN
      RAISE EXCEPTION 'Residual index alignment blocked: required column for %.% is missing.', spec.table_name, spec.index_name;
    END IF;

    SELECT ARRAY_AGG(attribute.attnum ORDER BY requested.position)
      INTO expected_attnums
    FROM unnest(spec.column_names) WITH ORDINALITY AS requested(column_name, position)
    JOIN pg_attribute AS attribute
      ON attribute.attrelid = table_oid
     AND attribute.attname = requested.column_name
     AND attribute.attnum > 0
     AND NOT attribute.attisdropped;

    SELECT ARRAY_AGG(default_opclass.oid ORDER BY requested.position)
      INTO expected_opclasses
    FROM unnest(expected_attnums) WITH ORDINALITY AS requested(attnum, position)
    JOIN pg_attribute AS attribute
      ON attribute.attrelid = table_oid
     AND attribute.attnum = requested.attnum
    JOIN pg_type AS attribute_type ON attribute_type.oid = attribute.atttypid
    JOIN pg_opclass AS default_opclass
      ON (
        default_opclass.opcintype = attribute.atttypid
        OR (attribute_type.typtype = 'e' AND default_opclass.opcintype = 'anyenum'::regtype)
      )
     AND default_opclass.opcdefault
     AND default_opclass.opcmethod = btree_method_oid;

    SELECT ARRAY_AGG(attribute.attcollation ORDER BY requested.position)
      INTO expected_collations
    FROM unnest(expected_attnums) WITH ORDINALITY AS requested(attnum, position)
    JOIN pg_attribute AS attribute
      ON attribute.attrelid = table_oid
     AND attribute.attnum = requested.attnum;

    expected_options := array_fill(0::smallint, ARRAY[cardinality(spec.column_names)]);

    IF cardinality(expected_opclasses) <> cardinality(spec.column_names)
      OR cardinality(expected_collations) <> cardinality(spec.column_names) THEN
      RAISE EXCEPTION 'Residual index alignment blocked: cannot resolve default btree semantics for %.%.', spec.table_name, spec.index_name;
    END IF;

    SELECT index_class.oid
      INTO named_index_oid
    FROM pg_class AS index_class
    WHERE index_class.relname = spec.index_name
      AND index_class.relnamespace = table_namespace;

    -- The schema-owned name must be an exact non-unique, non-partial, ascending
    -- btree index with no included columns or expression/operator-class variance.
    IF named_index_oid IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM pg_index AS index_definition
      JOIN pg_class AS index_class ON index_class.oid = index_definition.indexrelid
      WHERE index_definition.indexrelid = named_index_oid
        AND index_definition.indrelid = table_oid
        AND index_class.relkind = 'i'
        AND index_class.relam = btree_method_oid
        AND index_definition.indisvalid
        AND index_definition.indisready
        AND NOT index_definition.indisunique
        AND NOT index_definition.indisprimary
        AND NOT index_definition.indisexclusion
        AND index_definition.indpred IS NULL
        AND index_definition.indexprs IS NULL
        AND index_definition.indnkeyatts = cardinality(spec.column_names)
        AND index_definition.indnatts = cardinality(spec.column_names)
        AND ARRAY(
          SELECT vector_value
          FROM unnest(index_definition.indkey::smallint[])
               WITH ORDINALITY AS normalized(vector_value, position)
          ORDER BY position
        ) = expected_attnums
        AND ARRAY(
          SELECT vector_value
          FROM unnest(index_definition.indclass::oid[])
               WITH ORDINALITY AS normalized(vector_value, position)
          ORDER BY position
        ) = expected_opclasses
        AND ARRAY(
          SELECT vector_value
          FROM unnest(index_definition.indcollation::oid[])
               WITH ORDINALITY AS normalized(vector_value, position)
          ORDER BY position
        ) = expected_collations
        AND ARRAY(
          SELECT vector_value
          FROM unnest(index_definition.indoption::smallint[])
               WITH ORDINALITY AS normalized(vector_value, position)
          ORDER BY position
        ) = expected_options
    ) THEN
      RAISE EXCEPTION 'Residual index alignment blocked: index % exists with a definition incompatible with Prisma.', spec.index_name;
    END IF;

    IF named_index_oid IS NOT NULL THEN
      CONTINUE;
    END IF;

    -- A partial index over the same full key is not equivalent to the required
    -- full index. Stop rather than silently accepting predicate-limited coverage.
    IF EXISTS (
      SELECT 1
      FROM pg_index AS index_definition
      WHERE index_definition.indrelid = table_oid
        AND index_definition.indnkeyatts = cardinality(spec.column_names)
        AND index_definition.indnatts = cardinality(spec.column_names)
        AND ARRAY(
          SELECT vector_value
          FROM unnest(index_definition.indkey::smallint[])
               WITH ORDINALITY AS normalized(vector_value, position)
          ORDER BY position
        ) = expected_attnums
        AND index_definition.indpred IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Residual index alignment blocked: a partial index on %.% is not equivalent to required full index %.', spec.table_name, spec.column_names, spec.index_name;
    END IF;

    -- A unique index with otherwise matching physical semantics is deliberately
    -- not used as a substitute for Prisma's non-unique @@index declaration.
    IF EXISTS (
      SELECT 1
      FROM pg_index AS index_definition
      JOIN pg_class AS index_class ON index_class.oid = index_definition.indexrelid
      WHERE index_definition.indrelid = table_oid
        AND index_class.relkind = 'i'
        AND index_class.relam = btree_method_oid
        AND index_definition.indisvalid
        AND index_definition.indisready
        AND index_definition.indisunique
        AND NOT index_definition.indisprimary
        AND NOT index_definition.indisexclusion
        AND index_definition.indpred IS NULL
        AND index_definition.indexprs IS NULL
        AND index_definition.indnkeyatts = cardinality(spec.column_names)
        AND index_definition.indnatts = cardinality(spec.column_names)
        AND ARRAY(
          SELECT vector_value
          FROM unnest(index_definition.indkey::smallint[])
               WITH ORDINALITY AS normalized(vector_value, position)
          ORDER BY position
        ) = expected_attnums
        AND ARRAY(
          SELECT vector_value
          FROM unnest(index_definition.indclass::oid[])
               WITH ORDINALITY AS normalized(vector_value, position)
          ORDER BY position
        ) = expected_opclasses
        AND ARRAY(
          SELECT vector_value
          FROM unnest(index_definition.indcollation::oid[])
               WITH ORDINALITY AS normalized(vector_value, position)
          ORDER BY position
        ) = expected_collations
        AND ARRAY(
          SELECT vector_value
          FROM unnest(index_definition.indoption::smallint[])
               WITH ORDINALITY AS normalized(vector_value, position)
          ORDER BY position
        ) = expected_options
    ) THEN
      RAISE EXCEPTION 'Residual index alignment blocked: a unique index is not equivalent to required non-unique index %.', spec.index_name;
    END IF;

    -- A full equivalent under a historical name is safe and intentionally kept.
    SELECT index_class.relname
      INTO equivalent_index_name
    FROM pg_index AS index_definition
    JOIN pg_class AS index_class ON index_class.oid = index_definition.indexrelid
    WHERE index_definition.indrelid = table_oid
      AND index_class.relkind = 'i'
      AND index_class.relam = btree_method_oid
      AND index_definition.indisvalid
      AND index_definition.indisready
      AND NOT index_definition.indisunique
      AND NOT index_definition.indisprimary
      AND NOT index_definition.indisexclusion
      AND index_definition.indpred IS NULL
      AND index_definition.indexprs IS NULL
      AND index_definition.indnkeyatts = cardinality(spec.column_names)
      AND index_definition.indnatts = cardinality(spec.column_names)
      AND ARRAY(
        SELECT vector_value
        FROM unnest(index_definition.indkey::smallint[])
             WITH ORDINALITY AS normalized(vector_value, position)
        ORDER BY position
      ) = expected_attnums
      AND ARRAY(
        SELECT vector_value
        FROM unnest(index_definition.indclass::oid[])
             WITH ORDINALITY AS normalized(vector_value, position)
        ORDER BY position
      ) = expected_opclasses
      AND ARRAY(
        SELECT vector_value
        FROM unnest(index_definition.indcollation::oid[])
             WITH ORDINALITY AS normalized(vector_value, position)
        ORDER BY position
      ) = expected_collations
      AND ARRAY(
        SELECT vector_value
        FROM unnest(index_definition.indoption::smallint[])
             WITH ORDINALITY AS normalized(vector_value, position)
        ORDER BY position
      ) = expected_options
    LIMIT 1;

    IF equivalent_index_name IS NOT NULL THEN
      RAISE NOTICE 'Residual index alignment retained equivalent index % for expected index %.', equivalent_index_name, spec.index_name;
      CONTINUE;
    END IF;

    SELECT string_agg(format('%I', requested.column_name), ', ' ORDER BY requested.position)
      INTO expected_columns_sql
    FROM unnest(spec.column_names) WITH ORDINALITY AS requested(column_name, position);

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %s (%s)',
      spec.index_name,
      table_oid::regclass,
      expected_columns_sql
    );

    IF NOT EXISTS (
      SELECT 1
      FROM pg_index AS index_definition
      JOIN pg_class AS index_class ON index_class.oid = index_definition.indexrelid
      WHERE index_class.relname = spec.index_name
        AND index_class.relnamespace = table_namespace
        AND index_definition.indrelid = table_oid
        AND index_class.relkind = 'i'
        AND index_class.relam = btree_method_oid
        AND index_definition.indisvalid
        AND index_definition.indisready
        AND NOT index_definition.indisunique
        AND NOT index_definition.indisprimary
        AND NOT index_definition.indisexclusion
        AND index_definition.indpred IS NULL
        AND index_definition.indexprs IS NULL
        AND index_definition.indnkeyatts = cardinality(spec.column_names)
        AND index_definition.indnatts = cardinality(spec.column_names)
        AND ARRAY(
          SELECT vector_value
          FROM unnest(index_definition.indkey::smallint[])
               WITH ORDINALITY AS normalized(vector_value, position)
          ORDER BY position
        ) = expected_attnums
        AND ARRAY(
          SELECT vector_value
          FROM unnest(index_definition.indclass::oid[])
               WITH ORDINALITY AS normalized(vector_value, position)
          ORDER BY position
        ) = expected_opclasses
        AND ARRAY(
          SELECT vector_value
          FROM unnest(index_definition.indcollation::oid[])
               WITH ORDINALITY AS normalized(vector_value, position)
          ORDER BY position
        ) = expected_collations
        AND ARRAY(
          SELECT vector_value
          FROM unnest(index_definition.indoption::smallint[])
               WITH ORDINALITY AS normalized(vector_value, position)
          ORDER BY position
        ) = expected_options
    ) THEN
      RAISE EXCEPTION 'Residual index alignment blocked: index % was not created with the required Prisma definition.', spec.index_name;
    END IF;
  END LOOP;
END $$;
