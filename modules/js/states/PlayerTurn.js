/**
 * We create one State class per declared state on the PHP side, to handle all state specific code here.
 * onEnteringState, onLeavingState and onPlayerActivationChange are predefined names that will be called by the framework.
 * When executing code in this state, you can access the args using this.args
 */
export class PlayerTurn {
  constructor(game, bga) {
    this.game = game;
    this.bga = bga;
    this.isCurrentPlayerActive = false;
    this.btnVisible = null;
    this.btnHide = null;
    this.btnConfirm = null;
    this.btnCancel = null;
    this.btnDestroy = null;
    this.btnMove = null;
    this.btnFlip = null;
  }

  /**
   * This method is called each time we are entering the game state. You can use this method to perform some user interface changes at this moment.
   */
  onEnteringState(args, isCurrentPlayerActive) {
    this.isCurrentPlayerActive = isCurrentPlayerActive;
    if (isCurrentPlayerActive) {
      this.game.showFlippableCards();
    }
    // this.bga.statusBar.setTitle(
    //   isCurrentPlayerActive
    //     ? _("${you} must choose a card to play")
    //     : _("${actplayer} must choose a card to play"),
    // );
    this.bga.statusBar.addActionButton(
      _("Confirm"),
      () => this.onConfirm(false),
      {
        id: "button_confirm_id",
        color: "primary",
      },
    );
    this.bga.statusBar.addActionButton(
      _("Visible (-1 AP)"),
      () => this.onConfirm(false),
      {
        id: "button_visible_id",
        color: "primary",
      },
    );
    this.bga.statusBar.addActionButton(
      _("Hidden (-2 AP)"),
      () => this.onConfirm(true),
      {
        id: "button_hide_id",
        color: "primary",
      },
    );
    this.bga.statusBar.addActionButton(
      _("Throw the card (-1 AP)"),
      () => this.onDestroy(),
      {
        id: "button_destroy_id",
        color: "primary",
      },
    );
    this.bga.statusBar.addActionButton(_("Move"), () => this.onMove(), {
      id: "button_move_id",
      color: "primary",
    });
    this.bga.statusBar.addActionButton(
      _("Flip opponent card (-2 AP)"),
      () => this.onFlip(),
      {
        id: "button_flip_id",
        color: "primary",
      },
    );
    this.bga.statusBar.addActionButton(_("Cancel"), () => this.onCancel(), {
      id: "button_cancel_id",
      color: "alert",
    });

    this.btnConfirm = document.getElementById("button_confirm_id");
    this.btnCancel = document.getElementById("button_cancel_id");
    this.btnVisible = document.getElementById("button_visible_id");
    this.btnHide = document.getElementById("button_hide_id");
    this.btnDestroy = document.getElementById("button_destroy_id");
    this.btnMove = document.getElementById("button_move_id");
    this.btnFlip = document.getElementById("button_flip_id");
    this.btnConfirm.style.display = "none";
    this.btnCancel.style.display = "none";
    this.btnVisible.style.display = "none";
    this.btnHide.style.display = "none";
    this.btnDestroy.style.display = "none";
    this.btnMove.style.display = "none";
    this.btnFlip.style.display = "none";
  }

  /**
   * This method is called each time we are leaving the game state. You can use this method to perform some user interface changes at this moment.
   */
  onLeavingState(args, isCurrentPlayerActive) {
    this.bga.statusBar.removeActionButtons();
    this.game.hideFlippableCards();
  }

  /**
   * This method is called each time the current player becomes active or inactive in a MULTIPLE_ACTIVE_PLAYER state. You can use this method to perform some user interface changes at this moment.
   * on MULTIPLE_ACTIVE_PLAYER states, you may want to call this function in onEnteringState using `this.onPlayerActivationChange(args, isCurrentPlayerActive)` at the end of onEnteringState.
   * If your state is not a MULTIPLE_ACTIVE_PLAYER one, you can delete this function.
   */
  onPlayerActivationChange(args, isCurrentPlayerActive) {}

  onConfirm(isHide) {
    if (!this.game.cardSelected || !this.game.positionSelected) {
      console.log("Please select a card and a position before confirming.");
      return;
    }

    const coords = this.game.positionSelected.id.split("_");
    let x = coords[1];
    let y = coords[2];
    if (!this.game.firstPlayer) {
      y = 8 - parseInt(y); // Mirror Y coordinate for second player
    }
    const cardId = this.game.cardSelected.id.split("_")[1];

    this.bga.actions.performAction("actPlayCard", {
      card_id: cardId,
      x: x,
      y: y,
      isHide: isHide,
      player_number: this.game.myPlayerNumber,
    });

    this.game.hidePlayablePositions();
    this.game.clearSelection();
  }

  onCancel() {
    this.game.clearSelection();
    this.bga.statusBar.setTitle(
      this.isCurrentPlayerActive
        ? _("${you} must choose a card to play")
        : _("${actplayer} must choose a card to play"),
    );
    this.game.hidePlayablePositions();
    this.game.hideMyCards();
    this.game.hideMovablePositions();
    this.hideButtons();
  }

  onMove() {
    if (
      !this.game.cardToMove ||
      (!this.game.positionToGo && !this.game.cardToSwap)
    ) {
      console.log("Please select a card to move and a destination position.");
      return;
    }
    const cardToMoveId = this.game.cardToMove.id.split("_")[1];
    const cardToSwapId = this.game.cardToSwap
      ? this.game.cardToSwap.id.split("_")[1]
      : null;
    this.bga.actions.performAction("actMoveCard", {
      card_movement_id: this.game.cardSelected.id.split("_")[1],
      card_toMove_id: cardToMoveId,
      card_toSwap_id: this.game.cardToSwap ? cardToSwapId : null,
      x: this.game.positionToGo
        ? this.game.positionToGo.id.split("_")[1]
        : null,
      y: this.game.positionToGo
        ? this.game.positionToGo.id.split("_")[2]
        : null,
      player_number: this.game.myPlayerNumber,
    });
    this.game.hideMovablePositions();
    this.game.hideMyCards();
    this.game.clearSelection();
  }

  onFlip() {
    if (!this.game.cardToFlip) {
      console.log("Please select an opponent's face-down card to flip.");
      return;
    }
    const cell = this.game.cardToFlip.parentElement;
    const coords = cell.id.split("_");
    const x = parseInt(coords[1]);
    const y = coords[2];
    const card = this.game.getCardByCoordinates(x, y);
    if (!card) {
      console.log("Could not find the card to flip.");
      return;
    }

    this.bga.actions.performAction("actFlipCard", {
      card_id: card.id,
    });

    this.game.clearSelection();
  }

  onDestroy() {
    if (!this.game.cardSelected) {
      console.log("Please select a card to throw.");
      return;
    }
    const cardId = this.game.cardSelected.id.split("_")[1];
    this.bga.actions.performAction("actThrowCard", {
      card_id: cardId,
    });
    this.game.hidePlayablePositions();
    this.game.clearSelection();
  }

  hideButtons() {
    this.btnConfirm.style.display = "none";
    this.btnVisible.style.display = "none";
    this.btnHide.style.display = "none";
    this.btnDestroy.style.display = "none";
    this.btnCancel.style.display = "none";
    this.btnMove.style.display = "none";
    this.btnFlip.style.display = "none";
  }
}
