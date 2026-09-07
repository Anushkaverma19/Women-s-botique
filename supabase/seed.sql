-- MEHRAÉ seed data
-- Realistic catalogue built from the ACTUAL supplied images in public/products/.
-- Safe to re-run: uses ON CONFLICT DO NOTHING / DO UPDATE throughout.

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
insert into public.categories (name, slug, description) values ('Sarees', 'sarees', 'Handloom and silk sarees blending heritage weaves with contemporary draping.') on conflict (slug) do update set name = excluded.name, description = excluded.description;
insert into public.categories (name, slug, description) values ('Lehengas', 'lehengas', 'Bridal and festive lehengas with hand embroidery and heirloom detailing.') on conflict (slug) do update set name = excluded.name, description = excluded.description;
insert into public.categories (name, slug, description) values ('Dresses', 'dresses', 'Contemporary silhouettes for evening, formal and everyday luxury occasions.') on conflict (slug) do update set name = excluded.name, description = excluded.description;
insert into public.categories (name, slug, description) values ('Jewellery', 'jewellery', 'Statement and bridal jewellery crafted to complete the MEHRAÉ look.') on conflict (slug) do update set name = excluded.name, description = excluded.description;

-- ---------------------------------------------------------------------------
-- products, images, variants
-- ---------------------------------------------------------------------------
insert into public.products (
  category_id, name, slug, description, short_description, base_price, compare_at_price,
  material, care, color_family, occasion_tags, featured, active
) values (
  (select id from public.categories where slug = 'sarees'),
  'Noor Ivory Silk Saree', 'noor-ivory-silk-saree', 'Woven in pure mulberry silk, the Noor saree pairs a fluid ivory drape with a fine zari border for a look that moves between temple mornings and candlelit receptions. Pair with the coordinating orange blouse for a classic contrast, or restyle with jewel tones for evening.', 'An ivory silk saree finished with a hand-worked zari border.',
  12800, 15500, 'Pure mulberry silk with zari border', 'Dry clean only',
  'Ivory', ARRAY['wedding','festive','evening']::text[], true, true
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  base_price = excluded.base_price, compare_at_price = excluded.compare_at_price, material = excluded.material,
  care = excluded.care, color_family = excluded.color_family, occasion_tags = excluded.occasion_tags,
  featured = excluded.featured, active = excluded.active;
insert into public.product_images (product_id, image_url, alt_text, sort_order)
select id, '/products/noor-ivory-silk-saree.jpg', 'Noor Ivory Silk Saree', 0
from public.products where slug = 'noor-ivory-silk-saree'
on conflict (product_id, image_url) do nothing;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Ivory', 'S', 'MEH-NOOIVO-S', 12800, 6, true
from public.products where slug = 'noor-ivory-silk-saree'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Ivory', 'M', 'MEH-NOOIVO-M', 12800, 9, true
from public.products where slug = 'noor-ivory-silk-saree'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Ivory', 'L', 'MEH-NOOIVO-L', 12800, 4, true
from public.products where slug = 'noor-ivory-silk-saree'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;

insert into public.products (
  category_id, name, slug, description, short_description, base_price, compare_at_price,
  material, care, color_family, occasion_tags, featured, active
) values (
  (select id from public.categories where slug = 'sarees'),
  'Gul Magenta Draped Saree', 'gul-magenta-draped-saree', 'Gul takes a rich magenta silk-cotton blend and finishes it with a generous gold zari border, giving the drape structure without weight. An easy choice for daytime festivities and family celebrations alike.', 'A magenta drape with a wide gold border, cut for effortless movement.',
  9600, null, 'Silk cotton blend with gold zari border', 'Dry clean recommended',
  'Magenta', ARRAY['festive','everyday-luxury']::text[], false, true
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  base_price = excluded.base_price, compare_at_price = excluded.compare_at_price, material = excluded.material,
  care = excluded.care, color_family = excluded.color_family, occasion_tags = excluded.occasion_tags,
  featured = excluded.featured, active = excluded.active;
insert into public.product_images (product_id, image_url, alt_text, sort_order)
select id, '/products/gul-magenta-draped-saree.jpg', 'Gul Magenta Draped Saree', 0
from public.products where slug = 'gul-magenta-draped-saree'
on conflict (product_id, image_url) do nothing;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Magenta', 'S', 'MEH-GULMAG-S', 9600, 5, true
from public.products where slug = 'gul-magenta-draped-saree'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Magenta', 'M', 'MEH-GULMAG-M', 9600, 0, true
from public.products where slug = 'gul-magenta-draped-saree'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Magenta', 'L', 'MEH-GULMAG-L', 9600, 7, true
from public.products where slug = 'gul-magenta-draped-saree'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;

insert into public.products (
  category_id, name, slug, description, short_description, base_price, compare_at_price,
  material, care, color_family, occasion_tags, featured, active
) values (
  (select id from public.categories where slug = 'sarees'),
  'Ishani Silver Grey Saree', 'ishani-silver-grey-saree', 'Ishani is cut from a lustrous tissue silk in silver grey, catching light with every fold. Delicate thread embroidery along the pallu keeps the styling refined rather than heavy - suited to formal dinners and evening receptions.', 'A tissue silk saree in silver grey with fine thread embroidery.',
  11200, 13000, 'Tissue silk with silver thread work', 'Dry clean only',
  'Silver Grey', ARRAY['evening','formal']::text[], true, true
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  base_price = excluded.base_price, compare_at_price = excluded.compare_at_price, material = excluded.material,
  care = excluded.care, color_family = excluded.color_family, occasion_tags = excluded.occasion_tags,
  featured = excluded.featured, active = excluded.active;
insert into public.product_images (product_id, image_url, alt_text, sort_order)
select id, '/products/ishani-silver-grey-saree.jpg', 'Ishani Silver Grey Saree', 0
from public.products where slug = 'ishani-silver-grey-saree'
on conflict (product_id, image_url) do nothing;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Silver Grey', 'S', 'MEH-ISHSIL-S', 11200, 4, true
from public.products where slug = 'ishani-silver-grey-saree'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Silver Grey', 'M', 'MEH-ISHSIL-M', 11200, 6, true
from public.products where slug = 'ishani-silver-grey-saree'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Silver Grey', 'L', 'MEH-ISHSIL-L', 11200, 3, true
from public.products where slug = 'ishani-silver-grey-saree'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;

insert into public.products (
  category_id, name, slug, description, short_description, base_price, compare_at_price,
  material, care, color_family, occasion_tags, featured, active
) values (
  (select id from public.categories where slug = 'sarees'),
  'Anaya Gold Silk Saree', 'anaya-gold-silk-saree', 'Anaya is woven in a Kanjivaram-style silk with an antique gold finish that reads as heirloom rather than trend. A traditional choice for wedding functions, mehndi mornings and festive pujas.', 'A Kanjivaram-style silk saree in a warm antique gold.',
  13500, null, 'Kanjivaram-style silk', 'Dry clean only',
  'Gold', ARRAY['wedding','festive']::text[], false, true
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  base_price = excluded.base_price, compare_at_price = excluded.compare_at_price, material = excluded.material,
  care = excluded.care, color_family = excluded.color_family, occasion_tags = excluded.occasion_tags,
  featured = excluded.featured, active = excluded.active;
insert into public.product_images (product_id, image_url, alt_text, sort_order)
select id, '/products/anaya-gold-silk-saree.jpg', 'Anaya Gold Silk Saree', 0
from public.products where slug = 'anaya-gold-silk-saree'
on conflict (product_id, image_url) do nothing;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Gold', 'S', 'MEH-ANAGOL-S', 13500, 3, true
from public.products where slug = 'anaya-gold-silk-saree'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Gold', 'M', 'MEH-ANAGOL-M', 13500, 5, true
from public.products where slug = 'anaya-gold-silk-saree'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Gold', 'L', 'MEH-ANAGOL-L', 13500, 5, true
from public.products where slug = 'anaya-gold-silk-saree'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;

insert into public.products (
  category_id, name, slug, description, short_description, base_price, compare_at_price,
  material, care, color_family, occasion_tags, featured, active
) values (
  (select id from public.categories where slug = 'sarees'),
  'Meher Violet Shimmer Saree', 'meher-violet-shimmer-saree', 'Cut in a fluid shimmer organza, Meher moves between deep violet and soft lilac depending on the light. A striking option for evening functions where you want the fabric itself to do the talking.', 'A shimmer organza saree in a deep, luminous violet.',
  10400, 12200, 'Shimmer organza', 'Dry clean only',
  'Violet', ARRAY['evening','festive']::text[], false, true
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  base_price = excluded.base_price, compare_at_price = excluded.compare_at_price, material = excluded.material,
  care = excluded.care, color_family = excluded.color_family, occasion_tags = excluded.occasion_tags,
  featured = excluded.featured, active = excluded.active;
insert into public.product_images (product_id, image_url, alt_text, sort_order)
select id, '/products/meher-violet-shimmer-saree.jpg', 'Meher Violet Shimmer Saree', 0
from public.products where slug = 'meher-violet-shimmer-saree'
on conflict (product_id, image_url) do nothing;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Violet', 'S', 'MEH-MEHVIO-S', 10400, 5, true
from public.products where slug = 'meher-violet-shimmer-saree'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Violet', 'M', 'MEH-MEHVIO-M', 10400, 5, true
from public.products where slug = 'meher-violet-shimmer-saree'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Violet', 'L', 'MEH-MEHVIO-L', 10400, 2, true
from public.products where slug = 'meher-violet-shimmer-saree'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;

insert into public.products (
  category_id, name, slug, description, short_description, base_price, compare_at_price,
  material, care, color_family, occasion_tags, featured, active
) values (
  (select id from public.categories where slug = 'sarees'),
  'Farah Ivory Green Border Saree', 'farah-ivory-green-border-saree', 'Farah keeps things quiet - an ivory ground in cotton silk, with an emerald green woven border for definition. Suited to the office, formal daytime events, or a first foray into sarees.', 'An ivory cotton-silk saree with a woven emerald green border.',
  8900, null, 'Cotton silk with woven border', 'Gentle dry clean',
  'Ivory', ARRAY['everyday-luxury','formal']::text[], false, true
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  base_price = excluded.base_price, compare_at_price = excluded.compare_at_price, material = excluded.material,
  care = excluded.care, color_family = excluded.color_family, occasion_tags = excluded.occasion_tags,
  featured = excluded.featured, active = excluded.active;
insert into public.product_images (product_id, image_url, alt_text, sort_order)
select id, '/products/farah-ivory-green-border-saree.jpg', 'Farah Ivory Green Border Saree', 0
from public.products where slug = 'farah-ivory-green-border-saree'
on conflict (product_id, image_url) do nothing;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Ivory', 'S', 'MEH-FARIVO-S', 8900, 7, true
from public.products where slug = 'farah-ivory-green-border-saree'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Ivory', 'M', 'MEH-FARIVO-M', 8900, 8, true
from public.products where slug = 'farah-ivory-green-border-saree'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Ivory', 'L', 'MEH-FARIVO-L', 8900, 6, true
from public.products where slug = 'farah-ivory-green-border-saree'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;

insert into public.products (
  category_id, name, slug, description, short_description, base_price, compare_at_price,
  material, care, color_family, occasion_tags, featured, active
) values (
  (select id from public.categories where slug = 'lehengas'),
  'Zoya Festive Multicolour Lehenga', 'zoya-festive-multicolor-lehenga', 'Zoya layers pink, yellow and blue silk beneath a dupatta finished in zardozi and mirror work, built for sangeet nights and festive dancing. Fully lined and finished with an adjustable drawstring waist.', 'A festive lehenga in pink, yellow and blue with mirror embroidery.',
  32500, 38000, 'Silk with zardozi and mirror embroidery', 'Dry clean only',
  'Multicolour', ARRAY['festive','wedding','gift']::text[], true, true
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  base_price = excluded.base_price, compare_at_price = excluded.compare_at_price, material = excluded.material,
  care = excluded.care, color_family = excluded.color_family, occasion_tags = excluded.occasion_tags,
  featured = excluded.featured, active = excluded.active;
insert into public.product_images (product_id, image_url, alt_text, sort_order)
select id, '/products/zoya-festive-multicolor-lehenga.jpg', 'Zoya Festive Multicolour Lehenga', 0
from public.products where slug = 'zoya-festive-multicolor-lehenga'
on conflict (product_id, image_url) do nothing;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Multicolour', 'S', 'MEH-ZOYFES-S', 32500, 3, true
from public.products where slug = 'zoya-festive-multicolor-lehenga'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Multicolour', 'M', 'MEH-ZOYFES-M', 32500, 4, true
from public.products where slug = 'zoya-festive-multicolor-lehenga'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Multicolour', 'L', 'MEH-ZOYFES-L', 32500, 3, true
from public.products where slug = 'zoya-festive-multicolor-lehenga'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Multicolour', 'XL', 'MEH-ZOYFES-XL', 32500, 2, true
from public.products where slug = 'zoya-festive-multicolor-lehenga'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;

insert into public.products (
  category_id, name, slug, description, short_description, base_price, compare_at_price,
  material, care, color_family, occasion_tags, featured, active
) values (
  (select id from public.categories where slug = 'lehengas'),
  'Kavya Emerald Festive Lehenga', 'kavya-emerald-festive-lehenga', 'Kavya pairs a deep emerald skirt, dense with gold zari embroidery along the hem, with a contrast red blouse and dupatta - a combination rooted in traditional bridal party dressing. Comes with matching dupatta and can be restyled with statement jewellery.', 'A deep emerald festive lehenga with a contrast red blouse and gold zari work.',
  45000, 52000, 'Silk with gold zari embroidery', 'Dry clean only',
  'Emerald', ARRAY['wedding','festive']::text[], true, true
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  base_price = excluded.base_price, compare_at_price = excluded.compare_at_price, material = excluded.material,
  care = excluded.care, color_family = excluded.color_family, occasion_tags = excluded.occasion_tags,
  featured = excluded.featured, active = excluded.active;
insert into public.product_images (product_id, image_url, alt_text, sort_order)
select id, '/products/kavya-emerald-festive-lehenga.jpg', 'Kavya Emerald Festive Lehenga', 0
from public.products where slug = 'kavya-emerald-festive-lehenga'
on conflict (product_id, image_url) do nothing;
insert into public.product_images (product_id, image_url, alt_text, sort_order)
select id, '/products/kavya-emerald-festive-lehenga-alt.jpg', 'Kavya Emerald Festive Lehenga', 1
from public.products where slug = 'kavya-emerald-festive-lehenga'
on conflict (product_id, image_url) do nothing;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Emerald', 'S', 'MEH-KAVEME-S', 45000, 2, true
from public.products where slug = 'kavya-emerald-festive-lehenga'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Emerald', 'M', 'MEH-KAVEME-M', 45000, 4, true
from public.products where slug = 'kavya-emerald-festive-lehenga'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Emerald', 'L', 'MEH-KAVEME-L', 45000, 3, true
from public.products where slug = 'kavya-emerald-festive-lehenga'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Emerald', 'XL', 'MEH-KAVEME-XL', 45000, 0, true
from public.products where slug = 'kavya-emerald-festive-lehenga'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;

insert into public.products (
  category_id, name, slug, description, short_description, base_price, compare_at_price,
  material, care, color_family, occasion_tags, featured, active
) values (
  (select id from public.categories where slug = 'lehengas'),
  'Yamini Midnight Blue Lehenga', 'yamini-midnight-blue-lehenga', 'Yamini is worked in velvet through and through, with dense gold thread embroidery framing a dramatic circular hem. Built for the wedding reception moment - heavy in craftsmanship, not in weight.', 'A voluminous midnight blue velvet lehenga with dense gold embroidery.',
  58000, null, 'Velvet with gold thread embroidery', 'Dry clean only',
  'Midnight Blue', ARRAY['wedding','formal']::text[], false, true
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  base_price = excluded.base_price, compare_at_price = excluded.compare_at_price, material = excluded.material,
  care = excluded.care, color_family = excluded.color_family, occasion_tags = excluded.occasion_tags,
  featured = excluded.featured, active = excluded.active;
insert into public.product_images (product_id, image_url, alt_text, sort_order)
select id, '/products/yamini-midnight-blue-lehenga.jpg', 'Yamini Midnight Blue Lehenga', 0
from public.products where slug = 'yamini-midnight-blue-lehenga'
on conflict (product_id, image_url) do nothing;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Midnight Blue', 'S', 'MEH-YAMMID-S', 58000, 2, true
from public.products where slug = 'yamini-midnight-blue-lehenga'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Midnight Blue', 'M', 'MEH-YAMMID-M', 58000, 3, true
from public.products where slug = 'yamini-midnight-blue-lehenga'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Midnight Blue', 'L', 'MEH-YAMMID-L', 58000, 2, true
from public.products where slug = 'yamini-midnight-blue-lehenga'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Midnight Blue', 'XL', 'MEH-YAMMID-XL', 58000, 1, true
from public.products where slug = 'yamini-midnight-blue-lehenga'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;

insert into public.products (
  category_id, name, slug, description, short_description, base_price, compare_at_price,
  material, care, color_family, occasion_tags, featured, active
) values (
  (select id from public.categories where slug = 'lehengas'),
  'Aanya Coral Bridal Lehenga', 'aanya-coral-bridal-lehenga', 'Aanya is built for the wedding day itself - a coral silk lehenga dense with dabka and zardozi embroidery, paired with a matching dupatta and blouse. Structured for full-day wear with an internal support waistband.', 'A coral bridal lehenga with dabka and zardozi embroidery, dupatta included.',
  68000, 78000, 'Silk with dabka and zardozi bridal embroidery', 'Dry clean only',
  'Coral', ARRAY['wedding']::text[], true, true
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  base_price = excluded.base_price, compare_at_price = excluded.compare_at_price, material = excluded.material,
  care = excluded.care, color_family = excluded.color_family, occasion_tags = excluded.occasion_tags,
  featured = excluded.featured, active = excluded.active;
insert into public.product_images (product_id, image_url, alt_text, sort_order)
select id, '/products/aanya-coral-bridal-lehenga.jpg', 'Aanya Coral Bridal Lehenga', 0
from public.products where slug = 'aanya-coral-bridal-lehenga'
on conflict (product_id, image_url) do nothing;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Coral', 'S', 'MEH-AANCOR-S', 68000, 1, true
from public.products where slug = 'aanya-coral-bridal-lehenga'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Coral', 'M', 'MEH-AANCOR-M', 68000, 2, true
from public.products where slug = 'aanya-coral-bridal-lehenga'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Coral', 'L', 'MEH-AANCOR-L', 68000, 2, true
from public.products where slug = 'aanya-coral-bridal-lehenga'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Coral', 'XL', 'MEH-AANCOR-XL', 68000, 1, true
from public.products where slug = 'aanya-coral-bridal-lehenga'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;

insert into public.products (
  category_id, name, slug, description, short_description, base_price, compare_at_price,
  material, care, color_family, occasion_tags, featured, active
) values (
  (select id from public.categories where slug = 'lehengas'),
  'Meher Red Sequin Lehenga', 'meher-red-sequin-lehenga', 'Meher is finished edge to edge in fine sequin work over a silk lining, with a cape-style dupatta for a runway-ready silhouette. A confident choice for sangeet and reception functions.', 'A fully sequinned red lehenga with a matching cape dupatta.',
  41000, null, 'Sequin embellished net over silk lining', 'Dry clean only',
  'Red', ARRAY['festive','wedding','evening']::text[], false, true
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  base_price = excluded.base_price, compare_at_price = excluded.compare_at_price, material = excluded.material,
  care = excluded.care, color_family = excluded.color_family, occasion_tags = excluded.occasion_tags,
  featured = excluded.featured, active = excluded.active;
insert into public.product_images (product_id, image_url, alt_text, sort_order)
select id, '/products/meher-red-sequin-lehenga.jpg', 'Meher Red Sequin Lehenga', 0
from public.products where slug = 'meher-red-sequin-lehenga'
on conflict (product_id, image_url) do nothing;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Red', 'S', 'MEH-MEHRED-S', 41000, 3, true
from public.products where slug = 'meher-red-sequin-lehenga'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Red', 'M', 'MEH-MEHRED-M', 41000, 3, true
from public.products where slug = 'meher-red-sequin-lehenga'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Red', 'L', 'MEH-MEHRED-L', 41000, 2, true
from public.products where slug = 'meher-red-sequin-lehenga'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Red', 'XL', 'MEH-MEHRED-XL', 41000, 2, true
from public.products where slug = 'meher-red-sequin-lehenga'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;

insert into public.products (
  category_id, name, slug, description, short_description, base_price, compare_at_price,
  material, care, color_family, occasion_tags, featured, active
) values (
  (select id from public.categories where slug = 'dresses'),
  'Zara Burgundy Embellished Gown', 'zara-burgundy-embellished-gown', 'Zara is a fitted, off-shoulder gown in deep burgundy crepe with hand-placed embellishment tracing the bodice into a flowing train. Designed for evening receptions and formal galas.', 'An off-shoulder burgundy gown with hand embellishment and a train.',
  27500, 32000, 'Crepe with hand embellishment', 'Dry clean only',
  'Burgundy', ARRAY['evening','formal','wedding']::text[], true, true
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  base_price = excluded.base_price, compare_at_price = excluded.compare_at_price, material = excluded.material,
  care = excluded.care, color_family = excluded.color_family, occasion_tags = excluded.occasion_tags,
  featured = excluded.featured, active = excluded.active;
insert into public.product_images (product_id, image_url, alt_text, sort_order)
select id, '/products/zara-burgundy-embellished-gown.jpg', 'Zara Burgundy Embellished Gown', 0
from public.products where slug = 'zara-burgundy-embellished-gown'
on conflict (product_id, image_url) do nothing;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Burgundy', 'S', 'MEH-ZARBUR-S', 27500, 2, true
from public.products where slug = 'zara-burgundy-embellished-gown'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Burgundy', 'M', 'MEH-ZARBUR-M', 27500, 0, true
from public.products where slug = 'zara-burgundy-embellished-gown'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Burgundy', 'L', 'MEH-ZARBUR-L', 27500, 2, true
from public.products where slug = 'zara-burgundy-embellished-gown'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;

insert into public.products (
  category_id, name, slug, description, short_description, base_price, compare_at_price,
  material, care, color_family, occasion_tags, featured, active
) values (
  (select id from public.categories where slug = 'dresses'),
  'Vera Emerald Satin Wrap Dress', 'vera-emerald-satin-wrap-dress', 'Vera is cut from a fluid silk satin in emerald, wrapped and tied at the waist for an easy, unstructured silhouette. Equally suited to a daytime gifting occasion or a quiet evening at home.', 'A relaxed emerald silk satin wrap dress for easy, everyday luxury.',
  10800, null, 'Silk satin', 'Dry clean recommended',
  'Emerald', ARRAY['everyday-luxury','gift']::text[], false, true
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  base_price = excluded.base_price, compare_at_price = excluded.compare_at_price, material = excluded.material,
  care = excluded.care, color_family = excluded.color_family, occasion_tags = excluded.occasion_tags,
  featured = excluded.featured, active = excluded.active;
insert into public.product_images (product_id, image_url, alt_text, sort_order)
select id, '/products/vera-emerald-satin-wrap-dress.jpg', 'Vera Emerald Satin Wrap Dress', 0
from public.products where slug = 'vera-emerald-satin-wrap-dress'
on conflict (product_id, image_url) do nothing;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Emerald', 'XS', 'MEH-VEREME-XS', 10800, 4, true
from public.products where slug = 'vera-emerald-satin-wrap-dress'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Emerald', 'S', 'MEH-VEREME-S', 10800, 6, true
from public.products where slug = 'vera-emerald-satin-wrap-dress'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Emerald', 'M', 'MEH-VEREME-M', 10800, 5, true
from public.products where slug = 'vera-emerald-satin-wrap-dress'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Emerald', 'L', 'MEH-VEREME-L', 10800, 3, true
from public.products where slug = 'vera-emerald-satin-wrap-dress'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;

insert into public.products (
  category_id, name, slug, description, short_description, base_price, compare_at_price,
  material, care, color_family, occasion_tags, featured, active
) values (
  (select id from public.categories where slug = 'dresses'),
  'Aria Black One-Shoulder Dress', 'aria-black-one-shoulder-dress', 'Aria is a minimal, sculpted one-shoulder dress in stretch crepe, finished with a draped asymmetric hem. A modern counterpoint to the rest of the collection - suited to formal dinners and evening events.', 'A sculpted black one-shoulder dress with a draped asymmetric hem.',
  15600, 18000, 'Stretch crepe', 'Dry clean only',
  'Black', ARRAY['evening','formal']::text[], false, true
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  base_price = excluded.base_price, compare_at_price = excluded.compare_at_price, material = excluded.material,
  care = excluded.care, color_family = excluded.color_family, occasion_tags = excluded.occasion_tags,
  featured = excluded.featured, active = excluded.active;
insert into public.product_images (product_id, image_url, alt_text, sort_order)
select id, '/products/aria-black-one-shoulder-dress.jpg', 'Aria Black One-Shoulder Dress', 0
from public.products where slug = 'aria-black-one-shoulder-dress'
on conflict (product_id, image_url) do nothing;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Black', 'XS', 'MEH-ARIBLA-XS', 15600, 3, true
from public.products where slug = 'aria-black-one-shoulder-dress'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Black', 'S', 'MEH-ARIBLA-S', 15600, 5, true
from public.products where slug = 'aria-black-one-shoulder-dress'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Black', 'M', 'MEH-ARIBLA-M', 15600, 5, true
from public.products where slug = 'aria-black-one-shoulder-dress'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Black', 'L', 'MEH-ARIBLA-L', 15600, 2, true
from public.products where slug = 'aria-black-one-shoulder-dress'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;

insert into public.products (
  category_id, name, slug, description, short_description, base_price, compare_at_price,
  material, care, color_family, occasion_tags, featured, active
) values (
  (select id from public.categories where slug = 'jewellery'),
  'Aafreen Bridal Jewellery Set', 'aafreen-bridal-jewellery-set', 'A coordinated bridal set - maang tikka, jhumka earrings and a stack of bangles - finished in kundan and pearl detailing on a gold-plated base. Presented in a keepsake box, making it a considered wedding gift as much as a bridal choice.', 'A complete bridal set: maang tikka, jhumkas and bangles in kundan and pearl.',
  24500, 29000, 'Gold-plated brass with kundan and pearl detailing', 'Store in a dry pouch, avoid perfume contact',
  'Gold', ARRAY['wedding','gift']::text[], true, true
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  base_price = excluded.base_price, compare_at_price = excluded.compare_at_price, material = excluded.material,
  care = excluded.care, color_family = excluded.color_family, occasion_tags = excluded.occasion_tags,
  featured = excluded.featured, active = excluded.active;
insert into public.product_images (product_id, image_url, alt_text, sort_order)
select id, '/products/aafreen-bridal-jewellery-set.jpg', 'Aafreen Bridal Jewellery Set', 0
from public.products where slug = 'aafreen-bridal-jewellery-set'
on conflict (product_id, image_url) do nothing;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Gold', 'One Size', 'MEH-AAFBRI-ONE', 24500, 4, true
from public.products where slug = 'aafreen-bridal-jewellery-set'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;

insert into public.products (
  category_id, name, slug, description, short_description, base_price, compare_at_price,
  material, care, color_family, occasion_tags, featured, active
) values (
  (select id from public.categories where slug = 'jewellery'),
  'Aafreen Pearl Statement Earrings', 'aafreen-pearl-statement-earrings', 'Aafreen''s statement jhumkas cascade in freshwater pearl drops from a gold-plated dome - substantial enough to anchor a plain saree or dress, light enough for a full evening of wear.', 'Long jhumka-style earrings with cascading pearl drops.',
  6200, null, 'Gold-plated brass with pearl drops', 'Store in a dry pouch, avoid perfume contact',
  'Gold', ARRAY['evening','festive','gift']::text[], false, true
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, short_description = excluded.short_description,
  base_price = excluded.base_price, compare_at_price = excluded.compare_at_price, material = excluded.material,
  care = excluded.care, color_family = excluded.color_family, occasion_tags = excluded.occasion_tags,
  featured = excluded.featured, active = excluded.active;
insert into public.product_images (product_id, image_url, alt_text, sort_order)
select id, '/products/aafreen-pearl-statement-earrings.jpg', 'Aafreen Pearl Statement Earrings', 0
from public.products where slug = 'aafreen-pearl-statement-earrings'
on conflict (product_id, image_url) do nothing;
insert into public.product_variants (product_id, color, size, sku, price, stock_quantity, active)
select id, 'Gold', 'One Size', 'MEH-AAFPEA-ONE', 6200, 12, true
from public.products where slug = 'aafreen-pearl-statement-earrings'
on conflict (sku) do update set stock_quantity = excluded.stock_quantity, active = excluded.active;

-- ---------------------------------------------------------------------------
-- coupons
-- ---------------------------------------------------------------------------
insert into public.coupons (code, discount_type, discount_value, minimum_order_amount, max_discount, active, expires_at)
values ('WELCOME10', 'percentage', 10, 2000, 5000, true, null)
on conflict (code) do update set discount_type = excluded.discount_type, discount_value = excluded.discount_value,
  minimum_order_amount = excluded.minimum_order_amount, max_discount = excluded.max_discount, active = excluded.active;
insert into public.coupons (code, discount_type, discount_value, minimum_order_amount, max_discount, active, expires_at)
values ('FESTIVE500', 'fixed', 500, 5000, null, true, null)
on conflict (code) do update set discount_type = excluded.discount_type, discount_value = excluded.discount_value,
  minimum_order_amount = excluded.minimum_order_amount, max_discount = excluded.max_discount, active = excluded.active;
