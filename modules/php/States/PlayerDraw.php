<?php

declare(strict_types=1);

namespace Bga\Games\pollen\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\Games\pollen\Game;

class PlayerDraw extends GameState
{
    public function __construct(protected Game $game)
    {
        parent::__construct(
            $game,
            id: 20,
            type: StateType::GAME,
            updateGameProgression: true,
            transitions: [
                'nextTurn' => NextPlayer::class,
                'endGame' => GameEnd::class,
            ]
        );
    }

    public function onEnteringState()
    {
        // Active next player
        $player_id = intval($this->game->getActivePlayerId());


        // Count cards in hand and draw up to 3
        $hand = $this->game->cards->getCardsInLocation('hand', $player_id);
        $cardsToDrawCount = 3 - count($hand);

        if ($cardsToDrawCount > 0) {
            $drawnCards = $this->game->cards->pickCards($cardsToDrawCount, 'deck_' . $player_id, $player_id);

            $this->bga->notify->player(
                $player_id,
                'cardsDrawn',
                '',
                [
                    'cards' => $drawnCards,
                    'player_id' => $player_id,
                ]
            );

            $this->bga->notify->all(
                'cardsDrawnOpponent',
                clienttranslate('${player_name} draws ${count} cards'),
                [
                    'player_id' => $player_id,
                    'player_name' => $this->game->getActivePlayerName(),
                    'count' => $cardsToDrawCount,
                ]
            );
        }

        // Continue to next turn
        $this->game->gamestate->nextState('nextTurn');
    }
}
