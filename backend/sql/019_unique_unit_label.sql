alter table properties add constraint unique_unit_label_per_building
  unique (building_id, unit_label);
