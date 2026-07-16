<?php

/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * pollen implementation : © Julien Coutouly julien.coutouly@gmail.com
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 */

declare(strict_types=1);

namespace Bga\Games\pollen\Managers;

use Bga\Games\pollen\Game;

/**
 * Board-position rules: which cells a number card can be played on, and
 * which cells a card on the board can move to. Pure geometry/occupancy
 * checks against the `card` and `flower` tables — no state-machine or
 * action-point concerns live here.
 */
class BoardGeometry
{
    public function __construct(private Game $game)
    {
    }

    public function getCardAtPosition(int $x, int $y): ?array
    {
        $cardsOnBoard = $this->game->cards->getCardsInLocation('board');
        foreach ($cardsOnBoard as $card) {
            if (str_starts_with($card['location_arg'], "{$x}{$y}")) {
                return $card;
            }
        }
        return null;
    }

    public function getPlayablePositions($player_id, int $player_number): array
    {
        $playablePositions = [];

        $remaining_ap = $this->game->getActionPoints($player_id);

        // Get all cards currently on the board
        $cardsOnBoard = $this->game->cards->getCardsInLocation('board');

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

            // --- My side (always playable with >= 1 AP) ---
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

            // --- Opponent's side (costs 2 AP) ---
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
     * Returns all positions a card can move to
     *
     * @param string $location_arg  Current position encoded as "XYF" (e.g. "351" = x=3, y=5, face=1)
     * @param int    $player_number 1 or 2
     * @return array  List of ['x' => int, 'y' => int]
     */
    public function getMovablePositions(string $location_arg, int $player_number, bool $isSwap): array
    {
        $cur_x = (int)$location_arg[0];
        $cur_y = (int)$location_arg[1];

        $movable = [];

        $directions = [
            [-1, -1],
            [0, -1],
            [1, -1],
            [-1,  0],
            [1,  0],
            [-1,  1],
            [0,  1],
            [1,  1],
        ];

        foreach ($directions as [$dx, $dy]) {
            $nx = $cur_x + $dx;
            $ny = $cur_y + $dy;

            // Off the board
            if ($nx < 1 || $nx > 5 || $ny < 1 || $ny > 7) {
                continue;
            }

            // Landing on flowers is forbidden
            if ($ny === 4) {
                continue;
            }

            // No gaps allowed (accounting for the source cell being freed)
            if (!$this->isValidDestination($nx, $ny, $cur_x, $cur_y, $isSwap)) {
                continue;
            }

            $movable[] = ['x' => $nx, 'y' => $ny];
        }

        return $movable;
    }

    /**
     * Checks that a destination respects the "no gaps" rule.
     * The source cell (src_x, src_y) is considered freed.
     * Opponent cards count as support.
     */
    private function isValidDestination(int $nx, int $ny, int $src_x, int $src_y, bool $isSwap): bool
    {
        // Check that freeing the source doesn't create a gap
        // Only if this isn't a swap (the swapped card replaces the source)
        if (!$isSwap) {
            if ($src_y > 4) {
                $cardAboveSrc = $this->getCardAtPosition($src_x, $src_y + 1);
                if ($cardAboveSrc !== null) {
                    $destinationFillsGap = ($nx === $src_x && $ny === $src_y + 1);
                    if (!$destinationFillsGap) {
                        return false;
                    }
                }
            }

            if ($src_y < 4) {
                $cardBelowSrc = $this->getCardAtPosition($src_x, $src_y - 1);
                if ($cardBelowSrc !== null) {
                    $destinationFillsGap = ($nx === $src_x && $ny === $src_y - 1);
                    if (!$destinationFillsGap) {
                        return false;
                    }
                }
            }
        }

        // Player 1's side: y > 4, cards grow from y=5 towards y=7
        if ($ny > 4) {
            if ($ny === 5) {
                return true;
            }
            // The cell below is the source: on a swap it will be occupied
            if ($nx === $src_x && ($ny - 1) === $src_y) {
                return $isSwap; // false for a plain move, true for a swap
            }
            return $this->getCardAtPosition($nx, $ny - 1) !== null;
        }

        // Player 2's side: y < 4, cards grow from y=3 towards y=1
        if ($ny < 4) {
            if ($ny === 3) {
                return true;
            }
            // The cell above is the source: on a swap it will be occupied
            if ($nx === $src_x && ($ny + 1) === $src_y) {
                return $isSwap;
            }
            return $this->getCardAtPosition($nx, $ny + 1) !== null;
        }

        return false;
    }
}
