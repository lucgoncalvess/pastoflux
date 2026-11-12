CREATE TABLE `occupations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`farm_id` integer NOT NULL,
	`area_id` integer NOT NULL,
	`lot_id` integer NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`recovery_days` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`farm_id`) REFERENCES `farms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lot_id`) REFERENCES `lots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `occupations_area_dates_idx` ON `occupations` (`area_id`,`started_at`,`ended_at`);--> statement-breakpoint
CREATE INDEX `occupations_farm_idx` ON `occupations` (`farm_id`);--> statement-breakpoint
CREATE TABLE `user_farms` (
	`user_id` text NOT NULL,
	`farm_id` integer NOT NULL,
	`role` text DEFAULT 'owner' NOT NULL,
	FOREIGN KEY (`farm_id`) REFERENCES `farms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_farms_user_farm_idx` ON `user_farms` (`user_id`,`farm_id`);--> statement-breakpoint
CREATE INDEX `user_farms_farm_idx` ON `user_farms` (`farm_id`);--> statement-breakpoint
ALTER TABLE `animals` ADD `weight` real;--> statement-breakpoint
ALTER TABLE `movements` ADD `origin_area_id` integer REFERENCES areas(id);--> statement-breakpoint
ALTER TABLE `movements` ADD `destination_area_id` integer REFERENCES areas(id);