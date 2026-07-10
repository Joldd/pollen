/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * pollen implementation : © <Your name here> <Your email address here>
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 *
 * Game.js
 *
 * pollen user interface script
 *
 * In this file, you are describing the logic of your user interface, in Javascript language.
 *
 */

import { PlayerTurn } from "./states/PlayerTurn.js";
import { BoardRenderer } from "./managers/BoardRenderer.js";
import { CardInteractions } from "./managers/CardInteractions.js";
import * as Notifications from "./managers/Notifications.js";

export class Game {
  constructor(bga) {
    this.bga = bga;

    // Declare the State classes
    this.playerTurn = new PlayerTurn(this, bga);
    this.bga.states.register("PlayerTurn", this.playerTurn);

    this.cardSelected = null;
    this.positionSelected = null;
    this.cardToMove = null;
    this.cardToSwap = null;
    this.positionToGo = null;
    this.elements = {}; // DOM node cache, populated by boardRenderer.render()

    this.boardRenderer = new BoardRenderer(this);
    this.cardInteractions = new CardInteractions(this);
  }

  // Moves cardElement into target, sliding it there. Reparents it first (so
  // the DOM is always correct even with animations off), then — if the
  // player has animations enabled — plays the slide as a fixed-position,
  // viewport-coordinate flight so it can never end up hidden behind another
  // element's background regardless of DOM nesting/stacking.
  async slide(cardElement, target) {
    if (!cardElement || !target) return;

    const from = cardElement.getBoundingClientRect();
    target.appendChild(cardElement);

    if (!this.bga.gameui.bgaAnimationsActive()) {
      return;
    }

    const to = cardElement.getBoundingClientRect();
    if (from.width === 0 || to.width === 0) {
      return; // one side isn't actually visible/laid out, nothing to animate
    }

    const original = {
      position: cardElement.style.position,
      top: cardElement.style.top,
      left: cardElement.style.left,
      width: cardElement.style.width,
      height: cardElement.style.height,
      margin: cardElement.style.margin,
      zIndex: cardElement.style.zIndex,
      transform: cardElement.style.transform,
    };

    // Fly via document.body: some targets (e.g. #bin) sit on a transformed
    // ancestor, and a transform anywhere in the chain turns that ancestor
    // into the containing block for `position: fixed`, breaking viewport
    // coordinates. Body never has a transform, so this keeps them honest.
    document.body.appendChild(cardElement);
    cardElement.style.position = "fixed";
    cardElement.style.margin = "0";
    cardElement.style.width = `${from.width}px`;
    cardElement.style.height = `${from.height}px`;
    cardElement.style.left = `${from.left}px`;
    cardElement.style.top = `${from.top}px`;
    cardElement.style.zIndex = "9999";

    const dx = to.left - from.left;
    const dy = to.top - from.top;

    const animation = cardElement.animate(
      [
        { transform: "translate(0, 0)" },
        { transform: `translate(${dx}px, ${dy}px)` },
      ],
      { duration: 400, easing: "ease-in-out" },
    );

    try {
      await animation.finished;
    } catch (e) {
      // animation.cancel() rejects `finished` — settle immediately instead
    }

    target.appendChild(cardElement);
    Object.assign(cardElement.style, original);
  }

  setup(gamedatas) {
    this.gamedatas = gamedatas;

    this.playable_positions = gamedatas.playable_positions; // Store playable positions for later use
    this.remaining_ap = gamedatas.remaining_ap; // Store remaining action points for later use

    // Store player number
    this.myPlayerNumber = gamedatas.player_number;
    this.firstPlayer = this.myPlayerNumber === 1;
    console.log("I am player:", this.myPlayerNumber); // 1 or 2

    this.boardRenderer.render(gamedatas);
    this.cardInteractions.attachPositionListeners();

    // Setup game notifications to handle (see "setupNotifications" method below)
    this.setupNotifications();
  }

  ///////////////////////////////////////////////////
  //// Delegates relied on by PlayerTurn and DOM event handlers

  hidePlayablePositions() {
    this.cardInteractions.hidePlayablePositions();
  }

  hideMyCards() {
    this.cardInteractions.hideMyCards();
  }

  hideMovablePositions() {
    this.cardInteractions.hideMovablePositions();
  }

  ///////////////////////////////////////////////////
  //// Reaction to cometD notifications

  /*
        setupNotifications:

        In this method, you associate each of your game notifications with your local method to handle it.

        Note: game notification names correspond to "notifyAllPlayers" and "notifyPlayer" calls in
                your pollen.game.php file.

    */
  setupNotifications() {
    console.log("notifications subscriptions setup");

    // automatically listen to the notifications, based on the `notif_xxx` function on this class.
    this.bga.notifications.setupPromiseNotifications();
  }

  // Each notif_xxx method must live on the Game instance itself (the framework
  // discovers them by name); the actual handling logic lives in managers/Notifications.js.
  notif_cardPlayed(args) {
    return Notifications.cardPlayed(this, args);
  }

  notif_cardMoved(args) {
    return Notifications.cardMoved(this, args);
  }

  notif_cardsDrawn(args) {
    return Notifications.cardsDrawn(this, args);
  }

  notif_cardsDrawnOpponent(args) {
    return Notifications.cardsDrawnOpponent(this, args);
  }

  notif_cardThrown(args) {
    return Notifications.cardThrown(this, args);
  }
}
