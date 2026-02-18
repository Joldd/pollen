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
                'endGame' => GameEnd::class,  // Si vous avez un état de fin de jeu
            ]
        );
    }

    public function onEnteringState()
    {
         // Active next player
        $player_id = intval($this->game->activeNextPlayer());
        
        // Reset action points to 3 for the new active player
        $this->game->setActionPoints($player_id, 3);
        
        // TODO: Check if game should end here
        // For example, check if deck is empty, or some end condition
        // if ($this->shouldGameEnd()) {
        //     $this->game->gamestate->nextState('endGame');
        //     return;
        // }
        
        // Continue to next turn
        $this->game->gamestate->nextState('nextTurn');
    }
}