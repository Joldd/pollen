<?php

/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * pollen implementation : © <Your name here> <Your email address here>
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 *
 * Game.php
 *
 * This is the main file for your game logic.
 *
 * In this PHP file, you are going to defines the rules of the game.
 */

declare(strict_types=1);

namespace Bga\Games\pollen;

use Bga\Games\pollen\States\PlayerTurn;
use Bga\GameFramework\Components\Counters\PlayerCounter;

class Game extends \Bga\GameFramework\Table
{
    public $cards;

    public PlayerCounter $playerEnergy;

    /**
     * Your global variables labels:
     *
     * Here, you can assign labels to global variables you are using for this game. You can use any number of global
     * variables with IDs between 10 and 99. If you want to store any type instead of int, use $this->globals instead.
     *
     * NOTE: afterward, you can get/set the global variables with `getGameStateValue`, `setGameStateInitialValue` or
     * `setGameStateValue` functions.
     */
    public function __construct()
    {
        parent::__construct();
        $this->initGameStateLabels([]); // mandatory, even if the array is empty

        $this->playerEnergy = $this->bga->counterFactory->createPlayerCounter('energy');


        // Initialize the deck
        $this->cards  = self::getNew("module.common.deck");
        $this->cards->init("card");
    }

    /**
     * Compute and return the current game progression.
     *
     * The number returned must be an integer between 0 and 100.
     *
     * This method is called each time we are in a game state with the "updateGameProgression" property set to true.
     *
     * @return int
     * @see ./states.inc.php
     */
    public function getGameProgression()
    {
        // TODO: compute and return the game progression

        return 0;
    }

    /**
     * Migrate database.
     *
     * You don't have to care about this until your game has been published on BGA. Once your game is on BGA, this
     * method is called everytime the system detects a game running with your old database scheme. In this case, if you
     * change your database scheme, you just have to apply the needed changes in order to update the game database and
     * allow the game to continue to run with your new version.
     *
     * @param int $from_version
     * @return void
     */
    public function upgradeTableDb($from_version)
    {
        //       if ($from_version <= 1404301345)
        //       {
        //            // ! important ! Use `DBPREFIX_<table_name>` for all tables
        //
        //            $sql = "ALTER TABLE `DBPREFIX_xxxxxxx` ....";
        //            $this->applyDbUpgradeToAllDB( $sql );
        //       }
        //
        //       if ($from_version <= 1405061421)
        //       {
        //            // ! important ! Use `DBPREFIX_<table_name>` for all tables
        //
        //            $sql = "CREATE TABLE `DBPREFIX_xxxxxxx` ....";
        //            $this->applyDbUpgradeToAllDB( $sql );
        //       }
    }

    /*
     * Gather all information about current game situation (visible by the current player).
     *
     * The method is called each time the game interface is displayed to a player, i.e.:
     *
     * - when the game starts
     * - when a player refreshes the game page (F5)
     */
    protected function getAllDatas(int $currentPlayerId): array
    {
        $result = [];
        // WARNING: We must only return information visible by the current player (using $currentPlayerId).
        $current_player_id = self::getCurrentPlayerId();
        // Get information about players.
        // NOTE: you can retrieve some extra field you added for "player" table in `dbmodel.sql` if you need it.
        $result["players"] = $this->getCollectionFromDb(
            "SELECT `player_id` `id`, `player_score` `score` FROM `player`"
        );
        $this->playerEnergy->fillResult($result);

        // Add current player ID
        $result['current_player_id'] = $current_player_id;
        // Add player number for current player
        $players = array_keys($result['players']);
        $result['player_number'] = array_search($current_player_id, $players) + 1;

        // TODO: Gather all information about current game situation (visible by player $current_player_id).
        // Get flowers
        $result['flowers'] = self::getObjectListFromDB(
            "SELECT position_x as x, position_y as y, flower_type as type 
         FROM flower"
        );

        // Get current player's hand (should be 3 cards)
        $result['hand'] = $this->cards->getCardsInLocation('hand', $current_player_id);

        // Get current player's objective card (should be 1 card)
        $objectiveCards = $this->cards->getCardsInLocation('objective', $current_player_id);
        $result['objective'] = reset($objectiveCards); // Get first card or false

        // Get cards on the board
        $result['board'] = self::getObjectListFromDB(
            "SELECT card_id as id, card_type as type, card_type_arg as type_arg, card_location_arg as location_arg
         FROM card
         WHERE card_location = 'board'"
        );

        // Get remaining cards count in current player's deck (should be 14 = 17 - 3)
        $result['deckCount'] = $this->cards->countCardsInLocation('deck_' . $current_player_id);

        // Get opponent's information
        foreach ($this->loadPlayersBasicInfos() as $player_id => $player) {
            if ($player_id != $current_player_id) {
                $result['opponent'] = array(
                    'hand_count' => $this->cards->countCardsInLocation('hand', $player_id),
                    'deck_count' => $this->cards->countCardsInLocation('deck_' . $player_id),
                    'has_objective' => $this->cards->countCardsInLocation('objective', $player_id) > 0
                );
            }
        }

        $result['playable_positions'] = $this->getPlayablePositions($current_player_id, $result['player_number']);

        $result['remaining_ap'] = $this->getActionPoints($current_player_id);

        return $result;
    }

    /**
     * This method is called only once, when a new game is launched. In this method, you must setup the game
     *  according to the game rules, so that the game is ready to be played.
     */
    protected function setupNewGame($players, $options = [])
    {
        $this->playerEnergy->initDb(array_keys($players), initialValue: 2);

        // Set the colors of the players with HTML color code
        $gameinfos = $this->getGameinfos();
        $default_colors = $gameinfos['player_colors'];

        foreach ($players as $player_id => $player) {
            $query_values[] = vsprintf("(%s, '%s', '%s')", [
                $player_id,
                array_shift($default_colors),
                addslashes($player["player_name"]),
            ]);
        }

        // Create players
        static::DbQuery(
            sprintf(
                "INSERT INTO player (player_id, player_color, player_name) VALUES %s",
                implode(",", $query_values)
            )
        );

        $this->reattributeColorsBasedOnPreferences($players, $gameinfos["player_colors"]);
        $this->reloadPlayersBasicInfos();

        // ===== SETUP FLOWERS =====
        // Random flower positions
        $flowerPositions = range(1, 5); // [1, 2, 3, 4, 5]
        shuffle($flowerPositions);

        // Insert flowers in database
        $sql = "INSERT INTO flower (position_x, position_y, flower_type) VALUES ";
        $values = [];
        foreach ($flowerPositions as $position => $flowerType) {
            $x = $position + 1; // position 1 to 5
            $y = 4; // fixed y position for flowers
            $values[] = "($x, $y, $flowerType)";
        }
        self::DbQuery($sql . implode(',', $values));

        // ===== CREATE OBJECTIVE CARDS =====
        $objectiveCards = array();
        for ($i = 1; $i <= 10; $i++) {
            $objectiveCards[] = array('type' => 'objective', 'type_arg' => $i, 'nbr' => 1);
        }

        // Create objective cards in their own location
        $this->cards->createCards($objectiveCards, 'objective_deck');
        $this->cards->shuffle('objective_deck');

        // ===== CREATE PLAYER DECKS AND DEAL CARDS =====
        $player_index = 1;
        foreach ($players as $player_id => $player) {
            // Deal 1 objective card to this player
            $this->cards->pickCardForLocation('objective_deck', 'objective', $player_id);

            // Create this player's deck
            $playerCards = array();
            $player_color = $player_index;

            // 2 cards with value 0
            $playerCards[] = array('type' => 'number', 'type_arg' => $player_color * 100 + 0, 'nbr' => 2);

            // 3 cards with value 1
            $playerCards[] = array('type' => 'number', 'type_arg' => $player_color * 100 + 1, 'nbr' => 3);

            // 3 cards with value 2
            $playerCards[] = array('type' => 'number', 'type_arg' => $player_color * 100 + 2, 'nbr' => 3);

            // 3 cards with value 3
            $playerCards[] = array('type' => 'number', 'type_arg' => $player_color * 100 + 3, 'nbr' => 3);

            // 3 cards with value 4
            $playerCards[] = array('type' => 'number', 'type_arg' => $player_color * 100 + 4, 'nbr' => 3);

            // 1 card with value 5
            $playerCards[] = array('type' => 'number', 'type_arg' => $player_color * 100 + 5, 'nbr' => 1);

            // 2 movement cards
            $playerCards[] = array('type' => 'movement', 'type_arg' => $player_color * 100, 'nbr' => 2);

            // Create cards in this player's personal deck
            $player_deck = 'deck_' . $player_id;
            $this->cards->createCards($playerCards, $player_deck);
            $this->cards->shuffle($player_deck);

            // Draw EXACTLY 3 starting cards
            $this->cards->pickCards(3, $player_deck, $player_id);

            $player_index++;
        }

        // Activate first player once everything has been initialized and ready
        $this->activeNextPlayer();

        return PlayerTurn::class;
    }

    // State arguments for playerTurn
    function argPlayerTurn()
    {
        $player_id = $this->getActivePlayerId();

        return array(
            'action_points' => $this->getActionPoints($player_id),
            'playable_cards' => $this->getPlayableCards($player_id)
        );
    }

    // Get current action points for a player
    function getActionPoints($player_id)
    {
        return $this->getUniqueValueFromDB(
            "SELECT player_action_points FROM player WHERE player_id = $player_id"
        );
    }

    // Set action points for a player
    function setActionPoints($player_id, $points)
    {
        $this->DbQuery(
            "UPDATE player SET player_action_points = $points WHERE player_id = $player_id"
        );
    }

    // Spend action points
    function spendActionPoints($player_id, $cost)
    {
        $current_ap = $this->getActionPoints($player_id);

        if ($current_ap < $cost) {
            throw new BgaUserException($this->_("Not enough action points"));
        }

        $new_ap = $current_ap - $cost;
        $this->setActionPoints($player_id, $new_ap);

        return $new_ap;
    }

    // Get playable cards for current player
    function getPlayableCards($player_id)
    {
        return $this->cards->getCardsInLocation('hand', $player_id);
    }

    public function getPlayablePositions($player_id, $player_number): array
    {
        $playablePositions = [];

        $remaining_ap = $this->getActionPoints($player_id);

        // Get all cards currently on the board
        $cardsOnBoard = $this->cards->getCardsInLocation('board');

        // Build a set of occupied positions for quick lookup
        $occupiedPositions = [];
        foreach ($cardsOnBoard as $card) {
            $occupiedPositions[$card['location_arg']] = true; // location_arg stores "x_y"
        }

        // Helper to check if a position is occupied
        $isOccupied = function (int $x, int $y) use ($occupiedPositions): bool {
            // location_arg is stored as integer: x.y.v concatenated (e.g. 250 = x=2, y=5, v=0)
            return isset($occupiedPositions["{$x}{$y}0"]) || isset($occupiedPositions["{$x}{$y}1"]);
        };

        if ($player_number === 1) {
            $mySideY    = [5, 7, +1];
            $theirSideY = [3, 1, -1];
            $mySideStart    = 5;
            $theirSideStart = 3;
        } else {
            $mySideY    = [3, 1, -1]; // for($y=3; $y>=1; $y--)
            $theirSideY = [5, 7, +1]; // for($y=5; $y<=7; $y++)
            $mySideStart    = 3;
            $theirSideStart = 5;
        }

        for ($x = 1; $x <= 5; $x++) {

            // --- Mon côté (toujours jouable si >= 1 AP) ---
            [$yStart, $yEnd, $yStep] = $mySideY;
            for ($y = $yStart; $yStep > 0 ? $y <= $yEnd : $y >= $yEnd; $y += $yStep) {
                if ($isOccupied($x, $y)) continue;

                $hasGap = false;
                $checkStep = $yStep > 0 ? 1 : -1;
                for ($checkY = $mySideStart; $checkY !== $y; $checkY += $checkStep) {
                    if (!$isOccupied($x, $checkY)) {
                        $hasGap = true;
                        break;
                    }
                }

                if (!$hasGap) {
                    $playablePositions[] = ['x' => $x, 'y' => $y];
                }
                break;
            }

            // --- Côté adversaire (coûte 2 AP) ---
            if ($remaining_ap < 2) continue;

            [$yStart, $yEnd, $yStep] = $theirSideY;
            for ($y = $yStart; $yStep > 0 ? $y <= $yEnd : $y >= $yEnd; $y += $yStep) {
                if ($isOccupied($x, $y)) continue;

                $hasGap = false;
                $checkStep = $yStep > 0 ? 1 : -1;
                for ($checkY = $theirSideStart; $checkY !== $y; $checkY += $checkStep) {
                    if (!$isOccupied($x, $checkY)) {
                        $hasGap = true;
                        break;
                    }
                }

                if (!$hasGap) {
                    $playablePositions[] = ['x' => $x, 'y' => $y];
                }
                break;
            }
        }

        return $playablePositions;
    }

    /**
     * Example of debug function.
     * Here, jump to a state you want to test (by default, jump to next player state)
     * You can trigger it on Studio using the Debug button on the right of the top bar.
     */
    public function debug_goToState(int $state = 3)
    {
        $this->gamestate->jumpToState($state);
    }

    /**
     * Another example of debug function, to easily test the zombie code.
     */
    public function debug_playOneMove()
    {
        $this->bga->debug->playUntil(fn(int $count) => $count == 1);
    }

    /*
    Another example of debug function, to easily create situations you want to test.
    Here, put a card you want to test in your hand (assuming you use the Deck component).

    public function debug_setCardInHand(int $cardType, int $playerId) {
        $card = array_values($this->cards->getCardsOfType($cardType))[0];
        $this->cards->moveCard($card['id'], 'hand', $playerId);
    }
    */
}
