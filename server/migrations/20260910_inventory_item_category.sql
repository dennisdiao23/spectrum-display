alter table public.inventory_items
  add column if not exists category text not null default '';

update public.inventory_items
set category = 'Service'
where btrim(category) = ''
  and (
    upper(sku || ' ' || name) like '%INSTALL%'
    or upper(sku || ' ' || name) like '%WARRANTY%'
    or upper(sku || ' ' || name) like '%SERVICE%'
    or upper(sku || ' ' || name) like '%LABOR%'
    or upper(sku || ' ' || name) like '%FREIGHT%'
  );

update public.inventory_items
set category = 'Control'
where btrim(category) = ''
  and (
    lower(brand_id) = 'novastar'
    or upper(sku || ' ' || name) like '%NOVASTAR%'
    or upper(sku || ' ' || name) like '%CONTROLLER%'
    or upper(sku || ' ' || name) like '%RECEIVING%'
    or upper(sku || ' ' || name) like '%PROCESSOR%'
    or upper(sku || ' ' || name) like '%CONTROL%'
  );

update public.inventory_items
set category = 'LED Panel'
where btrim(category) = ''
  and lower(unit) = 'panels';
