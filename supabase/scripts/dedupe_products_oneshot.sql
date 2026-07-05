-- One-shot duplicate-product cleanup, safe to run in the Supabase SQL Editor.
-- Runs without an auth context (unlike merge_duplicate_products(), which the app
-- calls). Scoped per organization; keeps the OLDEST product per name, preserves
-- sales/PO/return/transfer history by repointing it, and discards each
-- duplicate's stock so a double import does not double the on-hand.

BEGIN;

CREATE TEMP TABLE _dups ON COMMIT DROP AS
WITH canon AS (
  SELECT organization_id, lower(trim(name)) AS key,
         (array_agg(id ORDER BY created_at, id))[1] AS keep_id
  FROM public.products
  GROUP BY organization_id, lower(trim(name))
  HAVING count(*) > 1
)
SELECT p.id AS dup_id, c.keep_id
FROM public.products p
JOIN canon c
  ON c.organization_id = p.organization_id
 AND lower(trim(p.name)) = c.key
WHERE p.id <> c.keep_id;

UPDATE public.sale_items          t SET product_id = d.keep_id FROM _dups d WHERE t.product_id = d.dup_id;
UPDATE public.purchase_order_items t SET product_id = d.keep_id FROM _dups d WHERE t.product_id = d.dup_id;
UPDATE public.order_items          t SET product_id = d.keep_id FROM _dups d WHERE t.product_id = d.dup_id;
UPDATE public.sale_return_items    t SET product_id = d.keep_id FROM _dups d WHERE t.product_id = d.dup_id;
UPDATE public.stock_transfer_items t SET product_id = d.keep_id FROM _dups d WHERE t.product_id = d.dup_id;

DELETE FROM public.inventory_movements m USING _dups d WHERE m.product_id = d.dup_id;
DELETE FROM public.stocktake_items    s USING _dups d WHERE s.product_id = d.dup_id;
DELETE FROM public.batches            b USING _dups d WHERE b.product_id = d.dup_id;

DELETE FROM public.products p USING _dups d WHERE p.id = d.dup_id;

COMMIT;
