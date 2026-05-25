-- Add gate_key to creatures so the Bestiary can filter by seal
alter table creatures
  add column if not exists gate_key text references campaign_gates(key) on delete set null;

-- Seal of Water: Thessalmar + Drowned Reliquary
update creatures set gate_key = 'seal-of-water'
  where id in (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000116'
  );

-- Stormcrest Spire: Silvaclaw + Stormcrest Sentinel
update creatures set gate_key = 'stormcrest-spire'
  where id in (
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000118'
  );

-- Radiant Temple: Vexmire + Hollow Saint
update creatures set gate_key = 'radiant-temple'
  where id in (
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000117'
  );

-- Umbral Vault: Nyx + Shadow-touched Monk
update creatures set gate_key = 'umbral-vault'
  where id in (
    '00000000-0000-0000-0000-000000000104',
    '00000000-0000-0000-0000-000000000119'
  );

-- Five Seals Broken: Infernadax (approved=false until final gate opens)
update creatures set gate_key = 'five-seals-broken'
  where id = '00000000-0000-0000-0000-000000000105';

-- All remaining canon creatures are always available
update creatures set gate_key = 'always'
  where origin = 'canon' and gate_key is null;
