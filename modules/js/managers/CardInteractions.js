/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * pollen implementation : © Julien Coutouly julien.coutouly@gmail.com
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 *
 * Handles clicks on hand cards and board positions: card/position
 * selection, and highlighting of playable / movable cells.
 */
export class CardInteractions {
  constructor(game) {
    this.game = game;
  }

  attachPositionListeners() {
    document.querySelectorAll(".pln-position").forEach((card) => {
      card.addEventListener("click", (e) => this.onPositionSelected(e));
    });
  }

  // Clears every piece of selection state (and its "selected" highlight).
  // Must run after any action completes, successful or not: nothing else
  // reliably does — the notification-based cleanup keys off game.player_id,
  // which is never actually set, so it never fires.
  clearSelection() {
    const game = this.game;
    [
      "cardSelected",
      "positionSelected",
      "cardToMove",
      "cardToSwap",
      "positionToGo",
      "cardToFlip",
    ].forEach((key) => {
      if (game[key]) {
        game[key].classList.remove("pln-selected");
        game[key] = null;
      }
    });
  }

  getCardByCoordinates(x, y) {
    const game = this.game;
    if (!game.firstPlayer) {
      y = 8 - parseInt(y); // Mirror Y coordinate for second player
    }
    const card = game.gamedatas.board.find(
      (card) => card.location_arg[0] == x && card.location_arg[1] == y,
    );
    return card ?? null;
  }

  onPositionSelected(e) {
    e.preventDefault();
    e.stopPropagation();

    const game = this.game;
    game.playerTurn.hideButtons();

    const isCurrentPlayerActive = game.playerTurn.isCurrentPlayerActive;
    if (!isCurrentPlayerActive) {
      return; // Not this player's turn
    }

    // Flip: clicking directly on a face-down opponent card, no hand card
    // needed. Only when nothing else is mid-selection.
    if (!game.cardSelected && !game.cardToMove) {
      const cellCoords = e.currentTarget.id.split("_");
      const cellX = parseInt(cellCoords[1]);
      const cellY = cellCoords[2];
      const boardCard = this.getCardByCoordinates(cellX, cellY);
      const isOpponentFaceDown =
        boardCard &&
        boardCard.type_arg[0] != game.myPlayerNumber &&
        boardCard.location_arg[2] == 1 &&
        game.remaining_ap >= 2;

      if (isOpponentFaceDown) {
        if (game.cardToFlip) {
          game.cardToFlip.classList.remove("pln-selected");
        }
        game.cardToFlip = e.currentTarget.children[0];
        game.cardToFlip.classList.add("pln-selected");
        game.playerTurn.btnFlip.style.display = "inline-block";
        game.playerTurn.btnCancel.style.display = "inline-block";
        game.bga.statusBar.setTitle(
          _("${you} are about to reveal an opponent's card"),
        );
        return;
      }
    }

    if (!game.cardSelected) {
      return; // No card selected
    }

    const coords = e.currentTarget.id.split("_");
    const x = coords[1];
    let y = coords[2];

    //If a card to move is already selected, it means the player is selecting the destination for the movement
    if (game.cardToMove && e.currentTarget.classList.contains("pln-canGo")) {
      if (game.positionToGo) {
        game.positionToGo.classList.remove("pln-selected");
      }
      if (
        e.currentTarget.children.length > 0 &&
        e.currentTarget.children[0].classList.contains("pln-myCard")
      ) {
        //The player is selecting a card to swap with the card to move
        if (game.cardToSwap) {
          game.cardToSwap.classList.remove("pln-selected");
        }
        game.cardToSwap = e.currentTarget.children[0];
        game.cardToSwap.classList.add("pln-selected");
        game.bga.statusBar.setTitle(_("${you} are about to swap two cards"));
        game.playerTurn.btnMove.style.display = "inline-block";
        game.playerTurn.btnCancel.style.display = "inline-block";
        this.hideMovablePositions();
        this.hideOtherCards();
      } else {
        game.positionToGo = e.currentTarget; // Store the selected position for movement
        game.positionToGo.classList.add("pln-selected");
        game.playerTurn.btnMove.style.display = "inline-block";
        game.playerTurn.btnCancel.style.display = "inline-block";
        game.bga.statusBar.setTitle(_("${you} are about to move a card"));
        game.cardToSwap = null;
      }
    }

    //Select a card to move if a movement card is selected
    if (game.cardSelected.classList.contains("pln-movement")) {
      if (e.currentTarget.children.length === 0) {
        return; // No card to move in this position
      }
      if (game.cardToSwap) return; // Can't select a new card to move if a card to swap is already selected
      if (!e.currentTarget.children[0].classList.contains("pln-myCard")) {
        return; // Can't move opponent's card
      }
      if (game.cardToMove) {
        game.cardToMove.classList.remove("pln-selected");
      }
      game.cardToMove = e.currentTarget.children[0]; // Store the selected position for movement
      game.cardToMove.classList.add("pln-selected");
      game.bga.statusBar.setTitle(
        _("${you} must select a destination for the movement"),
      );
      game.playerTurn.btnCancel.style.display = "inline-block";
      const pos = {
        x: parseInt(x),
        y: game.firstPlayer ? parseInt(y) : 8 - parseInt(y),
      }; // Store original position of the card to move
      this.showMovablePositions(pos); // Show movable positions for the selected card
      return; // Movement cards don't require position selection
    }

    let cost = "";
    let pos = "";

    // Check if the clicked position is in the list of playable positions
    const index = game.playable_positions.findIndex(
      (pos) => pos.x == x && pos.y == (!game.firstPlayer ? 8 - parseInt(y) : y),
    );
    if (index === -1) return;

    if (y > 4) {
      game.playerTurn.btnVisible.style.display = "inline-block";
      if (game.remaining_ap >= 2) {
        game.playerTurn.btnHide.style.display = "inline-block";
      }
      pos = "your own side";
    } else {
      game.playerTurn.btnConfirm.style.display = "inline-block";
      pos = "opponent's side";
      cost = "(-2 AP)";
    }

    if (game.positionSelected) {
      game.positionSelected.classList.remove("pln-selected");
    }
    game.positionSelected = e.currentTarget;
    game.positionSelected.classList.add("pln-selected");

    const card = game.cardSelected.textContent.trim();

    game.playerTurn.btnCancel.style.display = "inline-block";
    game.bga.statusBar.setTitle(
      _("${you} are about to play ${card} on ${pos} ${cost}")
        .replace("${card}", card)
        .replace("${pos}", pos)
        .replace("${cost}", cost),
    );
  }

  onCardSelect(e) {
    e.preventDefault();
    e.stopPropagation();

    const game = this.game;
    const isCurrentPlayerActive = game.playerTurn.isCurrentPlayerActive;

    if (!isCurrentPlayerActive) {
      return; // Not this player's turn
    }

    // Picking a (new) hand card abandons any in-progress board interaction
    // (a partially chosen move, a pending flip...): reset all of it first,
    // otherwise leftover state (e.g. cardToMove + a stale "pln-canGo" cell)
    // can make a later position click fall into the wrong action branch.
    this.clearSelection();
    this.hideMyCards();
    this.hideMovablePositions();
    this.hidePlayablePositions();
    game.playerTurn.hideButtons();

    game.cardSelected = e.currentTarget;
    game.cardSelected.classList.add("pln-selected");

    if (game.cardSelected.classList.contains("pln-movement")) {
      this.hidePlayablePositions();
      game.bga.statusBar.setTitle(
        _("${you} must select one of your cards on the board to move it"),
      );
      this.showMovableCards();
    } else {
      this.hideMyCards();
      this.showPlayablePositions(game.playable_positions);
      game.bga.statusBar.setTitle(
        _("${you} must select a position on the board, or throw the card"),
      );
    }

    game.playerTurn.btnDestroy.style.display = "inline-block";
    game.playerTurn.btnCancel.style.display = "inline-block";
  }

  showMovablePositions(pos) {
    const game = this.game;
    // Clear previous highlights
    document.querySelectorAll(".pln-position").forEach((cell) => {
      cell.classList.remove("pln-canGo");
    });
    let y = pos.y;
    let diffY = 1;
    if (!game.firstPlayer) {
      y = 8 - parseInt(y); // Mirror Y coordinate for second player
      // diffY = -1;
    }
    const cardInFront = this.getCardByCoordinates(pos.x, y + diffY); // Check if there's a card in front of the card to move
    // Highlight new movable positions
    const card1 = document.querySelector(`#card_${pos.x + 1}_${y}`);
    if (
      card1 &&
      (!cardInFront || card1.children.length > 0) &&
      (this.getCardByCoordinates(pos.x + 1, y - diffY) || y - diffY === 4) &&
      (card1.children.length === 0 ||
        card1.children[0].classList.contains("pln-myCard"))
    ) {
      card1.classList.add("pln-canGo");
    }
    const card2 = document.querySelector(`#card_${pos.x - 1}_${y}`);
    if (
      card2 &&
      (!cardInFront || card2.children.length > 0) &&
      (this.getCardByCoordinates(pos.x - 1, y - diffY) || y - diffY === 4) &&
      (card2.children.length === 0 ||
        card2.children[0].classList.contains("pln-myCard"))
    ) {
      card2.classList.add("pln-canGo");
    }
    const card3 = document.querySelector(`#card_${pos.x}_${y + 1}`);
    if (
      card3 &&
      card3.children[0] &&
      card3.children[0].classList.contains("pln-myCard")
    ) {
      card3.classList.add("pln-canGo");
    }
    const card4 = document.querySelector(`#card_${pos.x}_${y - 1}`);
    if (
      card4 &&
      card4.children[0] &&
      card4.children[0].classList.contains("pln-myCard")
    ) {
      card4.classList.add("pln-canGo");
    }
    const card5 = document.querySelector(`#card_${pos.x + 1}_${y + 1}`);
    if (
      card5 &&
      (!cardInFront || card5.children.length > 0) &&
      (this.getCardByCoordinates(pos.x + 1, y + 1 - diffY) ||
        y + 1 - diffY === 4) &&
      (card5.children.length === 0 ||
        card5.children[0].classList.contains("pln-myCard"))
    ) {
      card5.classList.add("pln-canGo");
    }
    const card6 = document.querySelector(`#card_${pos.x - 1}_${y + 1}`);
    if (
      card6 &&
      (!cardInFront || card6.children.length > 0) &&
      (this.getCardByCoordinates(pos.x - 1, y + 1 - diffY) ||
        y + 1 - diffY === 4) &&
      (card6.children.length === 0 ||
        card6.children[0].classList.contains("pln-myCard"))
    ) {
      card6.classList.add("pln-canGo");
    }
    const card7 = document.querySelector(`#card_${pos.x + 1}_${y - 1}`);
    if (
      card7 &&
      (!cardInFront || card7.children.length > 0) &&
      (this.getCardByCoordinates(pos.x + 1, y - 1 - diffY) ||
        y - 1 - diffY === 4) &&
      (card7.children.length === 0 ||
        card7.children[0].classList.contains("pln-myCard"))
    ) {
      card7.classList.add("pln-canGo");
    }
    const card8 = document.querySelector(`#card_${pos.x - 1}_${y - 1}`);
    if (
      card8 &&
      (!cardInFront || card8.children.length > 0) &&
      (this.getCardByCoordinates(pos.x - 1, y - 1 - diffY) ||
        y - 1 - diffY === 4) &&
      (card8.children.length === 0 ||
        card8.children[0].classList.contains("pln-myCard"))
    ) {
      card8.classList.add("pln-canGo");
    }
  }

  hideMovablePositions() {
    document.querySelectorAll(".pln-position").forEach((cell) => {
      cell.classList.remove("pln-canGo");
      cell.classList.remove("pln-selected");
    });
  }

  showMovableCards() {
    document.querySelectorAll(".pln-myCard").forEach((card) => {
      if (card.parentNode.id !== "myCards" && card.parentNode.id !== "bin")
        card.classList.add("pln-movable");
    });
  }

  hideMyCards() {
    document.querySelectorAll(".pln-myCard").forEach((card) => {
      if (card === this.game.cardSelected) return;
      card.classList.remove("pln-movable");
      card.classList.remove("pln-selected");
    });
  }

  hideOtherCards() {
    document.querySelectorAll(".pln-myCard").forEach((card) => {
      if (card !== this.game.cardToMove && card !== this.game.cardToSwap) {
        card.classList.remove("pln-movable");
        card.classList.remove("pln-selected");
      }
    });
  }

  showPlayablePositions(positions) {
    const game = this.game;
    // Clear previous highlights
    document.querySelectorAll(".pln-position").forEach((cell) => {
      cell.classList.remove("pln-playable");
    });
    // Highlight new playable positions
    positions.forEach((pos) => {
      let y = pos.y;
      if (!game.firstPlayer) {
        y = 8 - parseInt(y); // Mirror Y coordinate for second player
      }
      const cell = document.getElementById(`card_${pos.x}_${y}`);
      if (cell) {
        cell.classList.add("pln-playable");
      }
    });
  }

  hidePlayablePositions() {
    document.querySelectorAll(".pln-position").forEach((cell) => {
      cell.classList.remove("pln-playable");
    });
    document.querySelector(".pln-position.pln-selected")?.classList.remove("pln-selected");
    this.game.positionSelected = null;
  }

  showFlippableCards() {
    const game = this.game;
    this.hideFlippableCards();
    game.gamedatas.board.forEach((card) => {
      const isOpponentFaceDown =
        card.type_arg[0] != game.myPlayerNumber &&
        card.location_arg[2] == 1 &&
        game.remaining_ap >= 2;
      if (!isOpponentFaceDown) return;

      const x = parseInt(card.location_arg[0]);
      let y = parseInt(card.location_arg[1]);
      if (!game.firstPlayer) {
        y = 8 - y; // Mirror Y coordinate for second player
      }
      const cell = document.getElementById(`card_${x}_${y}`);
      if (cell) {
        cell.classList.add("pln-flippable");
      }
    });

    // Cells only just got tagged "pln-flippable" above: (re)bind now so the
    // tooltip actually reaches them — addTooltipToClass only attaches to
    // nodes that already carry the class at call time, it doesn't watch the
    // DOM for future matches.
    game.bga.gameui?.addTooltipToClass(
      "pln-flippable",
      _("Face-down opponent's card: spend 2 AP to reveal its value"),
      "",
    );
  }

  hideFlippableCards() {
    document.querySelectorAll(".pln-flippable").forEach((cell) => {
      cell.classList.remove("pln-flippable");
    });
  }
}
