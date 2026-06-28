import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { parseFile, toPosixPath, type Card, type VaultConfig, type VaultModel } from '@mos/core';
import { VAULT_SOURCE } from '../../sources/vault-source.token';
import { CardDetail } from '../card-detail/card-detail';
import { IconComponent } from '../icon/icon';
import { IconArrowsDiagonal, IconX } from '../../icons/tabler-icons.generated';

/**
 * Side peek (F-021-S-03): a URL-driven slide-over that hosts the shared
 * {@link CardDetail} over a scrim, so a card opens without leaving the board.
 * It is host-agnostic — the host owns the `?peek=` URL param and feeds the id
 * (plus its already-loaded model + config); this component renders the dialog,
 * loads the card's body, manages focus and motion, and asks the host to
 * navigate. Reuses the detail surface unchanged (no second copy of header or
 * relations) and is read-only (ADR-002).
 *
 * A proper dialog: focus is trapped and **restored** to the triggering card on
 * close (CDK `cdkTrapFocus` + auto-capture), `aria-modal`, and `Esc` / scrim /
 * the close control all request a close. Motion (240ms in / 180ms out, slide +
 * scrim fade) rides Angular's `animate.enter`/`animate.leave`; reduced motion is
 * honored by the app-wide collapse in `styles.css` (design system §Motion).
 */
@Component({
  selector: 'app-card-peek',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardDetail, IconComponent, CdkTrapFocus],
  templateUrl: './card-peek.html',
  // Esc closes from anywhere in the trapped dialog: the keydown bubbles out of
  // the panel to this host. (No effect when closed — focus is then elsewhere.)
  host: { '(keydown.escape)': 'closePeek.emit()' },
})
export class CardPeek {
  private readonly source = inject(VAULT_SOURCE);

  /** The peeked card's id, from the host's `?peek=` param; `null` when closed. */
  readonly cardId = input.required<string | null>();
  /** The host's vault model — relations resolve against it (no second parse). */
  readonly model = input.required<VaultModel>();
  readonly config = input.required<VaultConfig>();

  /** Close requested (Esc, scrim click, or the close control). */
  readonly closePeek = output<void>();
  /** Expand requested: open the full card page for this id. */
  readonly expand = output<string>();
  /** Open a different card in the peek (relation click or in-body card link). */
  readonly peekCard = output<string>();
  /** Leave the peek for a wiki doc (an in-body link that resolved to a doc). */
  readonly openDoc = output<string>();

  protected readonly iconClose = IconX;
  protected readonly iconExpand = IconArrowsDiagonal;

  /** Markdown body of the peeked card ('' while loading or on read failure). */
  protected readonly body = signal<string>('');
  /** Set when the card's body can't be read, so the miss is visible (T-007). */
  protected readonly bodyError = signal<string>('');

  /** The resolved card, or `null` when no card in the model carries this id. */
  protected readonly card = computed<Card | null>(() => {
    const id = this.cardId();
    if (id === null) return null;
    return this.model().cards[id] ?? null;
  });

  /** Accessible name for the dialog — the card's title, else the bare id. */
  protected readonly dialogLabel = computed(() => this.card()?.title ?? `Card ${this.cardId()}`);

  /** Monotonic token: a newer body load invalidates an older one's writes. */
  private bodySeq = 0;

  constructor() {
    // Load the body whenever the peeked card changes — on open, on a relation
    // swap, and on live re-index: the host keeps its model fresh (F-005-S-01) and
    // a change to the open card's file gives it a new identity here, re-running
    // this. Relations stay live the same way, straight off the model input.
    effect(() => {
      this.card(); // track
      void this.loadBody();
    });
  }

  private async loadBody(): Promise<void> {
    const seq = ++this.bodySeq;
    const open = this.card();
    if (open === null) {
      this.body.set('');
      this.bodyError.set('');
      return;
    }
    try {
      const text = await this.source.readFile(open.path);
      if (seq !== this.bodySeq) return; // a newer card won the race
      this.body.set(parseFile(open.path, text).body);
      this.bodyError.set('');
    } catch (error: unknown) {
      if (seq !== this.bodySeq) return;
      this.body.set('');
      this.bodyError.set(
        `Couldn't read "${open.path}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * An in-body link resolved to a vault path (F-017): a board card swaps the
   * peek to that card; any other file (a wiki doc) leaves the peek for the
   * reader — so docs still open in the reader exactly as before.
   */
  protected onBodyNavigate(path: string): void {
    const posix = toPosixPath(path);
    const card = Object.values(this.model().cards).find((c) => toPosixPath(c.path) === posix);
    if (card) {
      this.peekCard.emit(card.id);
      return;
    }
    this.openDoc.emit(posix);
  }
}
