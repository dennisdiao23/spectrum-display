delete from public.inventory_item_locations
where qty is null or qty <= 0;
