import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CardThumb } from "./components/CardThumb";

const card = { id: 3, name: "Demo Card A", image_url: "https://demo-bank.test/card-art/a.png" };

describe("CardThumb", () => {
  it("shows the issuer's picture at card proportions", () => {
    render(<CardThumb card={card} width={96} />);
    const img = screen.getByRole("img", { name: "Demo Card A card" });
    expect(img.getAttribute("src")).toBe(card.image_url);
    expect(img.getAttribute("height")).toBe("61");
    expect(img.style.background).toContain("linear-gradient"); // color until it loads
    fireEvent.load(img);
    expect(img.style.background).toBe("");
  });

  it("falls back to the card color when the picture fails to load", () => {
    const { container } = render(<CardThumb card={card} width={96} />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector(".card-thumb-plain")).not.toBeNull();
  });

  it("draws the color block when there is no picture", () => {
    const { container } = render(<CardThumb card={{ ...card, image_url: null }} width={44} />);
    expect(screen.queryByRole("img")).toBeNull();
    const block = container.querySelector<HTMLElement>(".card-thumb-plain")!;
    expect(block.style.width).toBe("44px");
    expect(block.style.background).toContain("linear-gradient");
  });
});
