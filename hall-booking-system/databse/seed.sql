-- Seed data for EventSpace

-- NOTE: password hashes should be generated using bcrypt.
-- For local demo, you can set placeholder hashes or create admin/user via API.

-- Insert halls
INSERT INTO halls (name, slug, capacity, price_per_hour, description, features, image_urls)
VALUES
  (
    'Grand Hall',
    'hall-1',
    500,
    2500.00,
    'A grand and versatile venue for weddings, galas, and large conferences.',
    ARRAY['Stage', 'AV System', 'Parking', 'Catering-ready'],
    ARRAY['/assets/images/grand-1.jpg','/assets/images/grand-2.jpg']
  ),
  (
    'Conference Hall',
    'hall-2',
    220,
    1400.00,
    'Perfect for seminars, workshops, and corporate events.',
    ARRAY['Projector', 'Sound System', 'WiFi', 'Podium'],
    ARRAY['/assets/images/conf-1.jpg','/assets/images/conf-2.jpg']
  )
ON CONFLICT (slug) DO NOTHING;