/**
 * A form field people never see and spam bots fill in.
 *
 * The public Apply and Contact forms trigger an automatic reply to the
 * address typed in them, signed LD Move. Bots that crawl sites and fill
 * every input they find have already found these forms (the "Shashank
 * from BOL7" submissions of September and October 2026). A filled-in
 * trap tells the server the sender is not a person, and the server drops
 * the submission without sending anything.
 *
 * Off-screen rather than display:none or type="hidden": the cruder bots
 * skip fields they can tell are hidden, which is exactly the tell this
 * relies on them missing. tabIndex -1 keeps keyboard users out of it,
 * aria-hidden keeps screen readers out of it, and the name is one no
 * browser autofill knows, so a real prospect's browser cannot fill it in
 * and get them silently dropped.
 */
export const HONEYPOT_NAME = "ldm_check";

const HoneypotField = () => (
  <div
    aria-hidden="true"
    style={{
      position: "absolute",
      left: "-10000px",
      width: 1,
      height: 1,
      overflow: "hidden",
    }}
  >
    <label>
      Leave this field empty
      <input
        type="text"
        name={HONEYPOT_NAME}
        tabIndex={-1}
        autoComplete="off"
        defaultValue=""
      />
    </label>
  </div>
);

/** What ended up in the trap, read straight from the submitted form. */
export function honeypotValue(form: HTMLFormElement): string {
  return String(new FormData(form).get(HONEYPOT_NAME) ?? "");
}

export default HoneypotField;
