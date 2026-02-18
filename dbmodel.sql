CREATE TABLE IF NOT EXISTS `flower` (
  `flower_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `position_x` int(2) NOT NULL,
  `position_y` int(2) NOT NULL,
  `flower_type` int(1) NOT NULL,
  PRIMARY KEY (`flower_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `card` (
  `card_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `card_type` varchar(16) NOT NULL,
  `card_type_arg` int(11) NOT NULL,
  `card_location` varchar(16) NOT NULL,
  `card_location_arg` int(11) NOT NULL,
  PRIMARY KEY (`card_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 AUTO_INCREMENT=1;

ALTER TABLE `player` ADD `player_action_points` INT UNSIGNED NOT NULL DEFAULT 3;