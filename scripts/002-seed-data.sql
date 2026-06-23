-- Seed data for DropDeck development and testing
-- Inserts sample users, seller profiles, and drops

-- Clear existing data (careful - only for development!)
-- DELETE FROM checkout_log;
-- DELETE FROM orders;
-- DELETE FROM drops;
-- DELETE FROM seller_profiles;
-- DELETE FROM users;

-- Insert test users (password: password123 - bcrypt hashed with $2b$ format)
-- This hash is valid for bcryptjs comparison
INSERT INTO users (id, email, password_hash, role, name) VALUES
('11111111-1111-1111-1111-111111111111', 'seller1@example.com', '$2b$10$Wa5z5Og3ZnLXrqDLEqFbOOBrJoYVcGqVfIXwmwx9Zg8qF8a5OW2gS', 'seller', 'Nike Store'),
('22222222-2222-2222-2222-222222222222', 'seller2@example.com', '$2b$10$Wa5z5Og3ZnLXrqDLEqFbOOBrJoYVcGqVfIXwmwx9Zg8qF8a5OW2gS', 'seller', 'Adidas Store'),
('33333333-3333-3333-3333-333333333333', 'buyer1@example.com', '$2b$10$Wa5z5Og3ZnLXrqDLEqFbOOBrJoYVcGqVfIXwmwx9Zg8qF8a5OW2gS', 'buyer', 'Alice Johnson'),
('44444444-4444-4444-4444-444444444444', 'buyer2@example.com', '$2b$10$Wa5z5Og3ZnLXrqDLEqFbOOBrJoYVcGqVfIXwmwx9Zg8qF8a5OW2gS', 'buyer', 'Bob Smith'),
('55555555-5555-5555-5555-555555555555', 'buyer3@example.com', '$2b$10$Wa5z5Og3ZnLXrqDLEqFbOOBrJoYVcGqVfIXwmwx9Zg8qF8a5OW2gS', 'buyer', 'Carol White'),
('99999999-9999-9999-9999-999999999999', 'admin@example.com', '$2b$10$Wa5z5Og3ZnLXrqDLEqFbOOBrJoYVcGqVfIXwmwx9Zg8qF8a5OW2gS', 'admin', 'Admin User')
ON CONFLICT (id) DO NOTHING;

-- Insert seller profiles
INSERT INTO seller_profiles (id, user_id, store_name, store_slug, bio, payout_email) VALUES
('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Nike Store', 'nike-store', 'Official Nike drops', 'seller1@example.com'),
('a2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Adidas Store', 'adidas-store', 'Exclusive Adidas releases', 'seller2@example.com')
ON CONFLICT (id) DO NOTHING;

-- Insert drops
INSERT INTO drops (id, seller_id, title, description, image_urls, price, total_stock, start_time, end_time, status, max_per_buyer) VALUES
('b1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Nike Air Jordan 1 Retro High OG', 'Limited edition Air Jordan 1 with special colorway', ARRAY['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500'], 15000, 100, NOW() - INTERVAL '1 hour', NOW() + INTERVAL '12 hours', 'live', 3),
('b2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Adidas Ultra Boost 22', 'Next-gen comfort technology', ARRAY['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500'], 18000, 50, NOW() + INTERVAL '2 hours', NOW() + INTERVAL '14 hours', 'scheduled', 2),
('b3333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Nike Dunk Low Travis Scott', 'Collaboration edition - sold out', ARRAY['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500'], 20000, 25, NOW() - INTERVAL '24 hours', NOW() - INTERVAL '6 hours', 'sold_out', 1)
ON CONFLICT (id) DO NOTHING;
