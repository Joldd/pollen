<?php

declare(strict_types=1);

namespace Bga\Games\pollen\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\Games\pollen\Game;

class NextPlayer extends GameState
{
    public function __construct(protected Game $game) {
        parent::__construct(
            $game, 
            id: 90, 
            type: StateType::GAME,
            updateGameProgression: true,
            transitions: [
                'nextTurn' => PlayerTurn::class,
                'endGame' => GameEnd::class, 
            ]
        );
    }

    public function onEnteringState()
    {
         // Active next player
        $player_id = intval($this->game->activeNextPlayer());
        
        // Reset action points to 2 for the new active player
        $this->game->setActionPoints($player_id, 2);  
        
        // Continue to next turn
        $this->game->gamestate->nextState('nextTurn');
    }
}