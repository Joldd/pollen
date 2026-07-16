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
                'endGame' => EndScore::class,
            ]
        );
    }

    public function onEnteringState()
    {
        // Active next player
        $player_id = intval($this->game->getActivePlayerId());
        $player_number = (int) $this->game->getPlayerNoById($player_id);

        // Player 1 already ran out of cards on a previous turn: player 2 just
        // took their one final turn, so the game ends now, no draw needed.
        if ($this->game->getGameStateValue('game_ending') == 1) {
            $this->game->gamestate->nextState('endGame');
            return;
        }

        // Count cards in hand and draw up to 3
        $hand = $this->game->cards->getCardsInLocation('hand', $player_id);
        $cardsToDrawCount = 3 - count($hand);

        if ($cardsToDrawCount > 0) {
            $drawnCards = $this->game->cards->pickCards($cardsToDrawCount, 'deck_' . $player_id, $player_id);
            $deckCount = (int) $this->game->cards->countCardsInLocation('deck_' . $player_id);

            $this->bga->notify->player(
                $player_id,
                'cardsDrawn',
                '',
                [
                    'cards' => $drawnCards,
                    'player_id' => $player_id,
                    'deck_count' => $deckCount,
                ]
            );

            $this->bga->notify->all(
                'cardsDrawnOpponent',
                clienttranslate('${player_name} draws ${count} cards'),
                [
                    'player_id' => $player_id,
                    'player_name' => $this->game->getActivePlayerName(),
                    'count' => count($drawnCards),
                    'deck_count' => $deckCount,
                ]
            );
        }

        // This player has no cards left (deck is empty too, so the draw above found nothing)
        if ((int) $this->game->cards->countCardsInLocation('hand', $player_id) === 0) {
            if ($player_number === 1) {
                // Player 2 still gets one last turn before the game ends
                $this->game->setGameStateValue('game_ending', 1);
                $this->game->gamestate->nextState('nextTurn');
            } else {
                // Player 2 ran out: stop right away, no extra turn for player 1
                $this->game->gamestate->nextState('endGame');
            }
            return;
        }

        // Continue to next turn
        $this->game->gamestate->nextState('nextTurn');
    }
}
