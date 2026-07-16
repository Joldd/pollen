<?php

declare(strict_types=1);

namespace Bga\Games\pollen\States;

use Bga\GameFramework\StateType;
use Bga\Games\pollen\Game;
use Bga\Games\pollen\Managers\ScoreCalculator;

const ST_END_GAME = 99;

class EndScore extends \Bga\GameFramework\States\GameState
{

    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: 98,
            type: StateType::GAME,
        );
    }

    /**
     * Reveal all cards, tally each column's flower, and notify the final
     * breakdown, then hand off to BGA's own end-of-game screen right away.
     * That screen doesn't consume player time and doesn't hide the board,
     * so the client-side reveal animation keeps playing underneath it —
     * no need to gate the transition behind a player action.
     */
    public function onEnteringState() {
        $scoreCalculator = new ScoreCalculator($this->game);
        $result = $scoreCalculator->computeScores();

        foreach ($result['player_ids'] as $playerNumber => $playerId) {
            $this->game->setPlayerScore($playerId, $result['totals'][$playerNumber]);
        }

        $this->bga->notify->all(
            'scoreComputed',
            clienttranslate('Final scoring'),
            [
                'columns' => $result['columns'],
                'totals' => $result['totals'],
                'player_ids' => $result['player_ids'],
                'player_names' => $result['player_names'],
                'objectives' => $result['objectives'],
                'winner_player_number' => $result['winner_player_number'],
                // getCardsInLocation() is keyed by card id; array_values() gives
                // the plain sequential list the client's `.forEach` expects
                // (same shape as gamedatas.board sent at setup()).
                'board' => array_values($this->game->cards->getCardsInLocation('board')),
            ]
        );;

        return ST_END_GAME;
    }
}