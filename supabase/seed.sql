-- Safe starter destination data only; no fake businesses, reviews, or offers.
insert into public.destinations
  (slug, name, destination_type, country_code, summary, best_for, is_featured, is_published)
values
  ('south-africa','South Africa','country','ZA','Coastlines, creative cities, mountain landscapes and wildlife experiences.','{"wildlife","coast","culture","nature"}',true,true),
  ('kenya','Kenya','country','KE','Open savannah, wildlife encounters, coastal heritage and vibrant cities.','{"wildlife","coast","culture","nature"}',true,true),
  ('morocco','Morocco','country','MA','Historic medinas, mountain trails, desert horizons and rich food culture.','{"culture","nature","food"}',true,true),
  ('zanzibar','Zanzibar','island','TZ','Indian Ocean beaches, historic Stone Town and Swahili coastal heritage.','{"coast","culture","island"}',true,true),
  ('botswana','Botswana','country','BW','Vast wilderness, waterways and distinctive safari experiences.','{"wildlife","nature"}',true,true),
  ('seychelles','Seychelles','country','SC','Granite-framed beaches, island ecosystems and clear Indian Ocean water.','{"coast","island","nature"}',true,true)
on conflict (slug) do update set
  name=excluded.name,
  destination_type=excluded.destination_type,
  country_code=excluded.country_code,
  summary=excluded.summary,
  best_for=excluded.best_for,
  is_featured=excluded.is_featured,
  is_published=excluded.is_published;
