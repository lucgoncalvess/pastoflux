ALTER TABLE `areas` ADD `max_capacity` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE `alerts` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `farm_id` integer NOT NULL,
  `area_id` integer,
  `occupation_id` integer,
  `type` text NOT NULL,
  `title` text NOT NULL,
  `message` text NOT NULL,
  `due_date` text NOT NULL,
  `dedupe_key` text NOT NULL,
  `read_at` text,
  `task_id` integer,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`farm_id`) REFERENCES `farms`(`id`) ON DELETE cascade,
  FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON DELETE cascade,
  FOREIGN KEY (`occupation_id`) REFERENCES `occupations`(`id`) ON DELETE cascade,
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `alerts_farm_due_date_idx` ON `alerts` (`farm_id`, `due_date`);
--> statement-breakpoint
CREATE UNIQUE INDEX `alerts_dedupe_key_idx` ON `alerts` (`dedupe_key`);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `source_alert_id` integer REFERENCES `alerts`(`id`) ON DELETE set null;
--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_source_alert_idx` ON `tasks` (`source_alert_id`);
