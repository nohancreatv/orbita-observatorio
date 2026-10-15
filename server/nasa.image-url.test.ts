import { describe, expect, it } from "vitest";
import { safeNasaImage } from "./orbitService";

describe("NASA image URL boundary", () => {
  it.each(["https://nasa.gov/photo.jpg", "https://images-assets.nasa.gov/photo.jpg"])("accepts NASA HTTPS images: %s", url => {
    expect(safeNasaImage(url)).toBe(url);
  });
  it.each([undefined, "invalid", "http://images.nasa.gov/photo.jpg", "https://evilnasa.gov/photo.jpg", "https://nasa.gov.example.com/photo.jpg", "https://nasa.gov@evil.example/photo.jpg", "javascript:alert(1)"])("rejects untrusted image URLs: %s", url => {
    expect(safeNasaImage(url)).toBeNull();
  });
});
