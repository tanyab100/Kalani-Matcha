const address = "2836 El Capitan Drive, Pleasanton, CA 94566";

export const STORE = {
  name: "Nami Matcha",
  address,
  mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
};
