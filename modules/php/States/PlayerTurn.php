<?php

declare(strict_types=1);

namespace Bga\Games\pollen\States;

use Bga\GameFramework\StateType;
use Bga\Games\pollen\Game;
use Bga\GameFramework\States\PossibleAction;
use BgaUserException;
use Bga\Games\pollen\States\PlayerDraw;

class PlayerTurn extends \Bga\GameFramework\States\GameState
{
    public function __construct(protected Game $game)
    {
        parent::__construct(
            $game,
            id: 10,
            type: StateType::ACTIVE_PLAYER,
            transitions: [
                'nextPlayer' => PlayerDraw::class,
                'stayActive' => PlayerTurn::class,
            ],
            description: clienttranslate('${actplayer} must choose a card to play'),
            descriptionMyTurn: clienttranslate('${you} must choose a card to play'),
        );
    }

    public function getArgs(): array
    {
        $player_id = $this->game->getActivePlayerId();

        return [
            "action_points" => $this->game->getActionPoints($player_id),
        ];
    }

    private function isCellOccupied(int $x, int $y): bool
    {
        $position = $x * 10 + $y;
        $count = $this->game->cards->countCardsInLocation('board', $position);
        return $count > 0;
    }

    #[PossibleAction]
    public function actPlayCard(int $card_id, int $x, int $y, bool $isHide, int $player_number): void
    {
        // Validate action
        $player_id = $this->game->getActivePlayerId();

        // Get card info
        $card = $this->game->cards->getCard($card_id);

        // Verify card belongs to player
        if ($card['location'] != 'hand' || $card['location_arg'] != $player_id) {
            throw new BgaUserException($this->game->_("This is not your card"));
        }

        // Validate position
        if ($x < 1 || $x > 5 || $y < 1 || $y > 7 || $y == 4) {
            throw new BgaUserException($this->game->_("Invalid position"));
        }

        // Check if cell is occupied
        if ($this->isCellOccupied($x, $y)) {
            throw new BgaUserException($this->game->_("This cell is already occupied"));
        }

        $playablePositions = $this->game->getPlayablePositions($player_id, $player_number);
        // Check if it is playable position
        if (!in_array(['x' => $x, 'y' => $y], $playablePositions)) {
            throw new BgaUserException($this->game->_("You cannot play on this position"));
        }

        // Determine action type based on position
        $players = $this->game->loadPlayersBasicInfos();
        $player_no = array_search($player_id, array_keys($players)) + 1;

        // Check if playing on own side or opponent's side
        $is_own_side = $y > 4 && $player_no == 1 || $y < 4 && $player_no == 2;

        // Determine action cost
        $action_cost = $is_own_side ? 1 : 2;
        if ($isHide) $action_cost = 2; // Hiding always costs 2 AP

        // Check if player has enough action points
        $current_ap = $this->game->getActionPoints($player_id);
        if ($current_ap < $action_cost) {
            throw new BgaUserException($this->game->_("Not enough action points"));
        }

        // EXECUTE ACTION
        // Spend action points
        $remaining_ap = $this->game->spendActionPoints($player_id, $action_cost);

        // Move card to board
        $this->game->cards->moveCard($card_id, 'board', $x * 100 + $y * 10 + ($isHide ? 1 : 0));

        // Notify all players
        $action_type = $is_own_side ? 'own_side' : 'opponent_side';

        $is_next = false;
        // Who is the next player going to be after this action
        if ($remaining_ap > 0) {
            // Same player continues if they have AP remaining
            $next_player_id = $player_id;
            $next_player_number = $player_number;
        } else {
            // Next player if current player has no AP remaining
            $next_player_id = $this->game->getPlayerAfter($player_id);
            $next_player_number = $player_number === 1 ? 2 : 1;
            $this->game->setActionPoints($next_player_id, 2); // Reset AP for next player
            $remaining_ap = 2; // Reset AP for next player
            $is_next = true;
        }

        $playablePositions = $this->game->getPlayablePositions($next_player_id, $next_player_number);

        $this->bga->notify->all(
            'cardPlayed',
            clienttranslate('${player_name} plays a card on ${side_desc}'),
            [
                'player_id' => $player_id,
                'player_name' => $this->game->getActivePlayerName(),
                'card' => $card,
                'x' => $x,
                'y' => $y,
                'action_type' => $action_type,
                'action_cost' => $action_cost,
                'remaining_ap' => $remaining_ap,
                'is_hide' => $isHide,
                'playable_positions' => $playablePositions,
                'is_next' => $is_next,
                'side_desc' => $is_own_side ?
                    clienttranslate('their side') :
                    clienttranslate("opponent's side")
            ]
        );

        // Check if player has AP remaining
        if (!$is_next) {
            // Stay in same state
            $this->game->gamestate->nextState('stayActive');
        } else {
            // Go to next player
            $this->game->gamestate->nextState('nextPlayer');
        }
    }

    function zombie(int $playerId) {}
}
