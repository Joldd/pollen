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
    public function actThrowCard(int $card_id): void
    {
        // Validate action
        $player_id = $this->game->getActivePlayerId();
        $player_number = (int) $this->game->getPlayerNoById($player_id);

        // Get card info
        $card = $this->game->cards->getCard($card_id);

        // Verify card belongs to player
        if ($card['location'] != 'hand' || $card['location_arg'] != $player_id) {
            throw new BgaUserException($this->game->_("This is not your card"));
        }

        // Check if player has enough action points
        $current_ap = $this->game->getActionPoints($player_id);
        if ($current_ap < 1) {
            throw new BgaUserException($this->game->_("Not enough action points"));
        }

        // Spend action points
        $remaining_ap = $this->game->spendActionPoints($player_id, 1);

        // Throw card to bin
        $this->game->cards->moveCard($card_id, 'bin', time());

        $number = $card['type'] == 'movement' ? 'movement' : $card['type_arg'] % 100;

        [, , $remaining_ap, $is_next] = $this->game->resolveTurnAdvance($player_id, $player_number, $remaining_ap);

        $this->bga->notify->all(
            'cardThrown',
            clienttranslate('${player_name} throws a card ${number} into the bin'),
            [
                'player_id' => $player_id,
                'player_name' => $this->game->getActivePlayerName(),
                'card' => $card,
                'number' => $number,
                'remaining_ap' => $remaining_ap,
            ]
        );

        $this->game->advanceState($is_next);
    }

    #[PossibleAction]
    public function actPlayCard(int $card_id, int $x, int $y, bool $isHide, int $player_number): void
    {
        // Validate action
        $player_id = $this->game->getActivePlayerId();
        // Never trust the client-supplied player_number for ownership/cost
        // checks: recompute it server-side.
        $player_number = (int) $this->game->getPlayerNoById($player_id);

        // Get card info
        $card = $this->game->cards->getCard($card_id);

        // Verify card belongs to player
        if ($card['location'] != 'hand' || $card['location_arg'] != $player_id) {
            throw new BgaUserException($this->game->_("This is not your card"));
        }

        // Verify card type
        if ($card['type'] == 'movement') {
            throw new BgaUserException($this->game->_("You can't play movement cards"));
        }

        // Validate position
        if ($x < 1 || $x > 5 || $y < 1 || $y > 7 || $y == 4) {
            throw new BgaUserException($this->game->_("Invalid position"));
        }

        // Check if cell is occupied
        if ($this->isCellOccupied($x, $y)) {
            throw new BgaUserException($this->game->_("This cell is already occupied"));
        }

        $playablePositions = $this->game->board->getPlayablePositions($player_id, $player_number);
        // Check if it is playable position
        if (!in_array(['x' => $x, 'y' => $y], $playablePositions)) {
            throw new BgaUserException($this->game->_("You cannot play on this position"));
        }

        // Check if playing on own side or opponent's side
        $is_own_side = $this->game->isOwnSide($player_number, $y);

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

        [$next_player_id, $next_player_number, $remaining_ap, $is_next] =
            $this->game->resolveTurnAdvance($player_id, $player_number, $remaining_ap);

        $playablePositions = $this->game->board->getPlayablePositions($next_player_id, $next_player_number);

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

        $this->game->advanceState($is_next);
    }

    #[PossibleAction]
    public function actMoveCard(int $card_movement_id, int $card_toMove_id, ?int $card_toSwap_id, ?int $x, ?int $y, int $player_number): void
    {
        // Validate action
        $player_id = $this->game->getActivePlayerId();
        // Never trust the client-supplied player_number for ownership/cost
        // checks: recompute it server-side.
        $player_number = (int) $this->game->getPlayerNoById($player_id);

        // Get card info
        $cardToMove = $this->game->cards->getCard($card_toMove_id);
        $cardMovement = $this->game->cards->getCard($card_movement_id);
        $cardToSwap = null;
        if ($card_toSwap_id !== null) {
            $cardToSwap = $this->game->cards->getCard($card_toSwap_id);
            $x = (int)$cardToSwap['location_arg'][0];
            $y = (int)$cardToSwap['location_arg'][1];
        } else if ($player_number == 2) {
            $y = 8 - $y;
        }

        // Verify card belongs to player
        if ($cardToMove['location'] != 'board' || $cardToMove['type_arg'][0] != $player_number) {
            throw new BgaUserException($this->game->_("This is not your card"));
        }
        if ($cardMovement['location'] != 'hand' || $cardMovement['location_arg'] != $player_id) {
            throw new BgaUserException($this->game->_("This is not your movement card"));
        }
        if ($cardToSwap !== null && ($cardToSwap['location'] != 'board' || $cardToSwap['type_arg'][0] != $player_number)) {
            throw new BgaUserException($this->game->_("You can only swap with your own card"));
        }

        // Verify card type
        if ($cardToMove['type'] == 'movement') {
            throw new BgaUserException($this->game->_("You can't move movement cards"));
        }
        if ($cardMovement['type'] != 'movement') {
            throw new BgaUserException($this->game->_("You must use a movement card to move a card"));
        }
        if ($cardToSwap !== null && $cardToSwap['type'] == 'movement') {
            throw new BgaUserException($this->game->_("You can't swap movement cards"));
        }

        // Validate position
        if ($x < 1 || $x > 5 || $y < 1 || $y > 7 || $y == 4) {
            throw new BgaUserException($this->game->_("Invalid position"));
        }

        $old_x = (int)$cardToMove['location_arg'][0];
        $old_y = (int)$cardToMove['location_arg'][1];

        $isSwap = $card_toSwap_id !== null;

        $movablePositions = $this->game->board->getMovablePositions($cardToMove['location_arg'], $player_number, $isSwap);

        // Check if it is playable position
        $isPlayable = false;
        foreach ($movablePositions as $pos) {
            if ($pos['x'] === $x && $pos['y'] === $y) {
                $isPlayable = true;
                break;
            }
        }

        if (!$isPlayable) {
            throw new BgaUserException($this->game->_("You cannot move on this position"));
        }

        // Check if playing on own side or opponent's side
        $is_own_side = $this->game->isOwnSide($player_number, $y);

        // Determine action cost
        $action_cost = $is_own_side ? 1 : 2;

        // Check if player has enough action points
        $current_ap = $this->game->getActionPoints($player_id);
        if ($current_ap < $action_cost) {
            throw new BgaUserException($this->game->_("Not enough action points"));
        }

        // EXECUTE ACTION
        // Spend action points
        $remaining_ap = $this->game->spendActionPoints($player_id, $action_cost);

        // Move card on the board
        $faceToMove = (int)$cardToMove['location_arg'][2];
        $this->game->cards->moveCard($card_toMove_id, 'board', $x * 100 + $y * 10 + $faceToMove);
        // Throw card movement to bin
        $this->game->cards->moveCard($card_movement_id, 'bin', time());
        // If it's a swap, move the swapped card to the new position
        if ($cardToSwap !== null) {
            $faceToSwap = (int)$cardToSwap['location_arg'][2];
            $this->game->cards->moveCard($card_toSwap_id, 'board', $old_x * 100 + $old_y * 10 + $faceToSwap);
        }

        // Notify all players
        $action_type = $is_own_side ? 'own_side' : 'opponent_side';

        [$next_player_id, $next_player_number, $remaining_ap, $is_next] =
            $this->game->resolveTurnAdvance($player_id, $player_number, $remaining_ap);

        $playablePositions = $this->game->board->getPlayablePositions($next_player_id, $next_player_number);

        $this->bga->notify->all(
            'cardMoved',
            clienttranslate('${player_name} moved a card on ${side_desc}'),
            [
                'player_id' => $player_id,
                'player_name' => $this->game->getActivePlayerName(),
                'cardToMove' => $cardToMove,
                'cardMovement' => $cardMovement,
                'cardToSwap' => $cardToSwap,
                'x' => $x,
                'y' => $y,
                'old_x' => $old_x,
                'old_y' => $old_y,
                'action_type' => $action_type,
                'action_cost' => $action_cost,
                'remaining_ap' => $remaining_ap,
                'playable_positions' => $playablePositions,
                'is_next' => $is_next,
                'side_desc' => $is_own_side ?
                    clienttranslate('their side') :
                    clienttranslate("opponent's side")
            ]
        );

        $this->game->advanceState($is_next);
    }

    function zombie(int $playerId) {}
}
