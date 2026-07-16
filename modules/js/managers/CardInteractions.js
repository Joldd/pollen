/**
 * Handles clicks on hand cards and board positions: card/position
 * selection, and highlighting of playable / movable cells.
 */
export class CardInteractions {
  constructor(game) {
    this.game = game;
  }

  attachPositionListeners() {
    document.querySelectorAll(".position").forEach((card) => {
      card.addEventListener("click", (e) => this.onPositionSelected(e));
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

    if (!game.cardSelected) {
      return; // No card selected
    }

    const coords = e.currentTarget.id.split("_");
    const x = coords[1];
    let y = coords[2];

    //If a card to move is already selected, it means the player is selecting the destination for the movement
    if (game.cardToMove && e.currentTarget.classList.contains("canGo")) {
      if (game.positionToGo) {
        game.positionToGo.classList.remove("selected");
      }
      if (
        e.currentTarget.children.length > 0 &&
        e.currentTarget.children[0].classList.contains("myCard")
      ) {
        //The player is selecting a card to swap with the card to move
        if (game.cardToSwap) {
          game.cardToSwap.classList.remove("selected");
        }
        game.cardToSwap = e.currentTarget.children[0];
        game.cardToSwap.classList.add("selected");
        game.bga.statusBar.setTitle(_("${you} are about to swap two cards"));
        game.playerTurn.btnMove.style.display = "inline-block";
        game.playerTurn.btnCancel.style.display = "inline-block";
        this.hideMovablePositions();
        this.hideOtherCards();
      } else {
        game.positionToGo = e.currentTarget; // Store the selected position for movement
        game.positionToGo.classList.add("selected");
        game.playerTurn.btnMove.style.display = "inline-block";
        game.playerTurn.btnCancel.style.display = "inline-block";
        game.bga.statusBar.setTitle(_("${you} are about to move a card"));
        game.cardToSwap = null;
      }
    }

    //Select a card to move if a movement card is selected
    if (game.cardSelected.classList.contains("movement")) {
      if (e.currentTarget.children.length === 0) {
        return; // No card to move in this position
      }
      if (game.cardToSwap) return; // Can't select a new card to move if a card to swap is already selected
      if (!e.currentTarget.children[0].classList.contains("myCard")) {
        return; // Can't move opponent's card
      }
      if (game.cardToMove) {
        game.cardToMove.classList.remove("selected");
      }
      game.cardToMove = e.currentTarget.children[0]; // Store the selected position for movement
      game.cardToMove.classList.add("selected");
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
      game.positionSelected.classList.remove("selected");
    }
    game.positionSelected = e.currentTarget;
    game.positionSelected.classList.add("selected");

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

    if (game.cardSelected) {
      game.cardSelected.classList.remove("selected");
    }
    game.cardSelected = e.currentTarget;
    game.cardSelected.classList.add("selected");

    if (game.cardSelected.classList.contains("movement")) {
      this.hidePlayablePositions();
      game.bga.statusBar.setTitle(
        _("${you} must select one of your cards on the board to move it"),
      );
      this.showMovableCards();
    } else {
      this.hideMyCards();
      this.showPlayablePositions(game.playable_positions);
      game.bga.statusBar.setTitle(
        _("${you} must select a position on the board or "),
      );
    }

    game.playerTurn.btnDestroy.style.display = "inline-block";
    game.playerTurn.btnCancel.style.display = "inline-block";
  }

  showMovablePositions(pos) {
    const game = this.game;
    // Clear previous highlights
    document.querySelectorAll(".position").forEach((cell) => {
      cell.classList.remove("canGo");
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
        card1.children[0].classList.contains("myCard"))
    ) {
      card1.classList.add("canGo");
    }
    const card2 = document.querySelector(`#card_${pos.x - 1}_${y}`);
    if (
      card2 &&
      (!cardInFront || card2.children.length > 0) &&
      (this.getCardByCoordinates(pos.x - 1, y - diffY) || y - diffY === 4) &&
      (card2.children.length === 0 ||
        card2.children[0].classList.contains("myCard"))
    ) {
      card2.classList.add("canGo");
    }
    const card3 = document.querySelector(`#card_${pos.x}_${y + 1}`);
    if (
      card3 &&
      card3.children[0] &&
      card3.children[0].classList.contains("myCard")
    ) {
      card3.classList.add("canGo");
    }
    const card4 = document.querySelector(`#card_${pos.x}_${y - 1}`);
    if (
      card4 &&
      card4.children[0] &&
      card4.children[0].classList.contains("myCard")
    ) {
      card4.classList.add("canGo");
    }
    const card5 = document.querySelector(`#card_${pos.x + 1}_${y + 1}`);
    if (
      card5 &&
      (!cardInFront || card5.children.length > 0) &&
      (this.getCardByCoordinates(pos.x + 1, y + 1 - diffY) ||
        y + 1 - diffY === 4) &&
      (card5.children.length === 0 ||
        card5.children[0].classList.contains("myCard"))
    ) {
      card5.classList.add("canGo");
    }
    const card6 = document.querySelector(`#card_${pos.x - 1}_${y + 1}`);
    if (
      card6 &&
      (!cardInFront || card6.children.length > 0) &&
      (this.getCardByCoordinates(pos.x - 1, y + 1 - diffY) ||
        y + 1 - diffY === 4) &&
      (card6.children.length === 0 ||
        card6.children[0].classList.contains("myCard"))
    ) {
      card6.classList.add("canGo");
    }
    const card7 = document.querySelector(`#card_${pos.x + 1}_${y - 1}`);
    if (
      card7 &&
      (!cardInFront || card7.children.length > 0) &&
      (this.getCardByCoordinates(pos.x + 1, y - 1 - diffY) ||
        y - 1 - diffY === 4) &&
      (card7.children.length === 0 ||
        card7.children[0].classList.contains("myCard"))
    ) {
      card7.classList.add("canGo");
    }
    const card8 = document.querySelector(`#card_${pos.x - 1}_${y - 1}`);
    if (
      card8 &&
      (!cardInFront || card8.children.length > 0) &&
      (this.getCardByCoordinates(pos.x - 1, y - 1 - diffY) ||
        y - 1 - diffY === 4) &&
      (card8.children.length === 0 ||
        card8.children[0].classList.contains("myCard"))
    ) {
      card8.classList.add("canGo");
    }
  }

  hideMovablePositions() {
    document.querySelectorAll(".position").forEach((cell) => {
      cell.classList.remove("canGo");
      cell.classList.remove("selected");
    });
  }

  showMovableCards() {
    document.querySelectorAll(".myCard").forEach((card) => {
      if (card.parentNode.id !== "myCards" || card.parentNode.id !== "bin")
        card.classList.add("movable");
    });
  }

  hideMyCards() {
    document.querySelectorAll(".myCard").forEach((card) => {
      card.classList.remove("movable");
      card.classList.remove("selected");
    });
  }

  hideOtherCards() {
    document.querySelectorAll(".myCard").forEach((card) => {
      if (card !== this.game.cardToMove && card !== this.game.cardToSwap) {
        card.classList.remove("movable");
        card.classList.remove("selected");
      }
    });
  }

  showPlayablePositions(positions) {
    const game = this.game;
    // Clear previous highlights
    document.querySelectorAll(".position").forEach((cell) => {
      cell.classList.remove("playable");
    });
    // Highlight new playable positions
    positions.forEach((pos) => {
      let y = pos.y;
      if (!game.firstPlayer) {
        y = 8 - parseInt(y); // Mirror Y coordinate for second player
      }
      const cell = document.getElementById(`card_${pos.x}_${y}`);
      if (cell) {
        cell.classList.add("playable");
      }
    });
  }

  hidePlayablePositions() {
    document.querySelectorAll(".position").forEach((cell) => {
      cell.classList.remove("playable");
    });
    document.querySelector(".position.selected")?.classList.remove("selected");
    this.game.positionSelected = null;
  }
}
