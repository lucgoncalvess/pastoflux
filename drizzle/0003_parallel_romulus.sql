CREATE TABLE `rental_contact_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`offer_id` integer NOT NULL,
	`requester_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`offer_id`) REFERENCES `rental_offers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rental_contact_requests_offer_requester_idx` ON `rental_contact_requests` (`offer_id`,`requester_id`);--> statement-breakpoint
CREATE TABLE `rental_offers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`farm_id` integer NOT NULL,
	`area_id` integer NOT NULL,
	`region` text NOT NULL,
	`capacity` integer NOT NULL,
	`daily_rate` real NOT NULL,
	`contact` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`farm_id`) REFERENCES `farms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rental_offers_search_idx` ON `rental_offers` (`status`,`region`,`capacity`);--> statement-breakpoint
CREATE UNIQUE INDEX `rental_offers_area_active_idx` ON `rental_offers` (`area_id`,`status`);