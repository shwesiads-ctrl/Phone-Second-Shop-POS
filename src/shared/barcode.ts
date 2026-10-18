// Compact Code 128 identifier: numeric pairs remain legible on narrow thermal labels.
// This is an internal shop identifier, not a registered GS1/EAN retail code.
export function barcodeCandidate(uuid: string) {
  return (
    "P2" +
    (BigInt("0x" + uuid.replaceAll("-", "").slice(0, 12)) % 1_000_000_000_000n)
      .toString()
      .padStart(12, "0")
  );
}
