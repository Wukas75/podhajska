-- ---------------------------------------------------------------------------
-- brew_sheets: manually recorded results, filled in after brewing/fermentation
-- ---------------------------------------------------------------------------
alter table brew_sheets add column final_volume_liters numeric;
alter table brew_sheets add column og numeric;
alter table brew_sheets add column sg numeric;
alter table brew_sheets add column abv_percent numeric;
