ALTER TABLE `rental_offers` ADD `capacity_novilho` integer NOT NULL DEFAULT 1;
ALTER TABLE `rental_offers` ADD `capacity_medio` integer NOT NULL DEFAULT 1;
ALTER TABLE `rental_offers` ADD `capacity_grande` integer NOT NULL DEFAULT 1;
ALTER TABLE `rental_offers` ADD `monthly_rate_novilho` real NOT NULL DEFAULT 1;
ALTER TABLE `rental_offers` ADD `monthly_rate_medio` real NOT NULL DEFAULT 1;
ALTER TABLE `rental_offers` ADD `monthly_rate_grande` real NOT NULL DEFAULT 1;
ALTER TABLE `rental_offers` DROP COLUMN `capacity`;
ALTER TABLE `rental_offers` DROP COLUMN `daily_rate`;