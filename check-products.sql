-- Verificar si existen productos
SELECT COUNT(*) FROM product;

-- Ver todos los productos existentes
SELECT * FROM product ORDER BY id DESC LIMIT 10;
