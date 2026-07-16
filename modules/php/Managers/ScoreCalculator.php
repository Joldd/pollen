<?php

declare(strict_types=1);

namespace Bga\Games\pollen\Managers;

use Bga\Games\pollen\Game;

/**
 * End-of-game scoring: for each column, the species (bee/bumblebee) with the
 * higher total card value wins that column's flower — 1 point, +1 more if
 * the flower's type is part of the winner's objective card. Ties go to
 * whichever species has more cards in the column; a full tie (score and
 * count) wins nobody the flower.
 */
class ScoreCalculator
{
    // Objective card number => the 3 flower types (1-5) it rewards
    private const OBJECTIVE_FLOWERS = [
        0 => [1, 2, 5],
        1 => [1, 4, 5],
        2 => [3, 4, 5],
        3 => [1, 3, 4],
        4 => [1, 2, 4],
        5 => [2, 4, 5],
        6 => [1, 3, 5],
        7 => [1, 2, 3],
        8 => [2, 3, 5],
        9 => [2, 3, 4],
    ];

    public function __construct(private Game $game)
    {
    }

    public function computeScores(): array
    {
        $flowersByColumn = $this->game->getFlowers();

        $playersBasic = $this->game->loadPlayersBasicInfos();
        $playerIds = array_keys($playersBasic);
        $playerIdByNumber = [1 => $playerIds[0], 2 => $playerIds[1]];
        $playerNames = [
            1 => $playersBasic[$playerIdByNumber[1]]['player_name'] ?? '',
            2 => $playersBasic[$playerIdByNumber[2]]['player_name'] ?? '',
        ];

        $objectiveFlowers = [1 => [], 2 => []];
        $objectiveTypeArgs = [1 => null, 2 => null];
        foreach ([1, 2] as $playerNumber) {
            $objectiveCards = $this->game->cards->getCardsInLocation('objective', $playerIdByNumber[$playerNumber]);
            $objectiveCard = reset($objectiveCards);
            if ($objectiveCard !== false) {
                $objectiveTypeArgs[$playerNumber] = (int)$objectiveCard['type_arg'];
                $objectiveFlowers[$playerNumber] = self::OBJECTIVE_FLOWERS[(int)$objectiveCard['type_arg']] ?? [];
            }
        }

        $boardCards = $this->game->cards->getCardsInLocation('board');

        $columns = [];
        $totals = [1 => 0, 2 => 0];

        for ($x = 1; $x <= 5; $x++) {
            $scores = [1 => 0, 2 => 0];
            $counts = [1 => 0, 2 => 0];

            foreach ($boardCards as $card) {
                if ((int)$card['location_arg'][0] !== $x) {
                    continue;
                }
                $owner = (int)$card['type_arg'][0];
                $value = (int)$card['type_arg'] % 100;
                $scores[$owner] += $value;
                $counts[$owner]++;
            }

            $winner = null;
            if ($scores[1] > $scores[2]) {
                $winner = 1;
            } elseif ($scores[2] > $scores[1]) {
                $winner = 2;
            } elseif ($counts[1] > $counts[2]) {
                $winner = 1;
            } elseif ($counts[2] > $counts[1]) {
                $winner = 2;
            }
            // else: full tie on both score and card count, nobody wins the flower

            $flowerType = $flowersByColumn[$x] ?? null;
            $bonus = false;
            $points = 0;

            if ($winner !== null) {
                $points = 1;
                if ($flowerType !== null && in_array($flowerType, $objectiveFlowers[$winner], true)) {
                    $bonus = true;
                    $points = 2;
                }
                $totals[$winner] += $points;
            }

            $columns[] = [
                'x' => $x,
                'flower_type' => $flowerType,
                'bee_score' => $scores[1],
                'bee_count' => $counts[1],
                'bumblebee_score' => $scores[2],
                'bumblebee_count' => $counts[2],
                'winner' => $winner,
                'bonus' => $bonus,
                'points' => $points,
            ];
        }

        $winnerPlayerNumber = null;
        if ($totals[1] > $totals[2]) {
            $winnerPlayerNumber = 1;
        } elseif ($totals[2] > $totals[1]) {
            $winnerPlayerNumber = 2;
        }

        return [
            'columns' => $columns,
            'totals' => $totals,
            'player_ids' => $playerIdByNumber,
            'player_names' => $playerNames,
            'objectives' => $objectiveTypeArgs,
            'winner_player_number' => $winnerPlayerNumber,
        ];
    }
}
