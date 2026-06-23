-- Fix password hashes for all test users
-- Password: password123
-- Hash: $2b$10$Wa5z5Og3ZnLXrqDLEqFbOOBrJoYVcGqVfIXwmwx9Zg8qF8a5OW2gS

UPDATE users 
SET password_hash = '$2b$10$Wa5z5Og3ZnLXrqDLEqFbOOBrJoYVcGqVfIXwmwx9Zg8qF8a5OW2gS'
WHERE email IN (
  'seller1@example.com',
  'seller2@example.com',
  'buyer1@example.com',
  'buyer2@example.com',
  'buyer3@example.com',
  'admin@example.com'
);
