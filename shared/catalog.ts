// The one catalogue: the API seeds prices and stock from it, the web shows names, sizes and forms.
export type GlazeId = 'latte' | 'turchese' | 'ramina' | 'cobalto' | 'miele' | 'ferro';
export type Collection = 'tavola' | 'fiori' | 'fuoco';
export type FormId =
  | 'cup' | 'mug' | 'bowl' | 'sideplate' | 'plate'
  | 'budvase' | 'vase' | 'pitcher'
  | 'teabowl' | 'jar' | 'dish' | 'candle';
export type Lang = 'en' | 'it';
type Text = Record<Lang, string>;

export interface Piece {
  id: string;
  collection: Collection;
  form: FormId;
  /** euro cents, VAT included */
  price: number;
  /** height and widest diameter, mm */
  size: { h: number; d: number };
  capacityMl?: number;
  care: 'dishwasher' | 'hand';
  glazes: GlazeId[];
  name: Text;
  blurb: Text;
}

export interface Glaze {
  name: Text;
  note: Text;
  /** base colour, sRGB hex */
  color: string;
  /** colour where the glaze pools thin over edges and rims */
  edge: string;
  roughness: number;
  /** 0..1 density of iron speckle */
  speckle: number;
}

export const GLAZES: Record<GlazeId, Glaze> = {
  latte: { name: { en: 'Milk white', it: 'Bianco latte' }, note: { en: 'Tin-white, the classic Faenza ground', it: 'Bianco stannifero, il fondo classico di Faenza' }, color: '#eee8da', edge: '#c9b79a', roughness: 0.32, speckle: 0.35 },
  turchese: { name: { en: 'Turquoise', it: 'Turchese' }, note: { en: 'Alkaline copper blue', it: 'Blu di rame alcalino' }, color: '#3e9f9a', edge: '#b9d8cf', roughness: 0.18, speckle: 0.1 },
  ramina: { name: { en: 'Copper green', it: 'Verde ramina' }, note: { en: 'The green of old Faenza jugs', it: 'Il verde delle antiche brocche faentine' }, color: '#5b8a4f', edge: '#c6c58a', roughness: 0.22, speckle: 0.2 },
  cobalto: { name: { en: 'Cobalt blue', it: 'Blu cobalto' }, note: { en: 'Deep, almost ink', it: 'Profondo, quasi inchiostro' }, color: '#22397f', edge: '#6f86c2', roughness: 0.16, speckle: 0.05 },
  miele: { name: { en: 'Honey', it: 'Miele' }, note: { en: 'Amber, breaks brown on the rim', it: 'Ambra, vira al bruno sul bordo' }, color: '#c48a2c', edge: '#6b3f17', roughness: 0.2, speckle: 0.25 },
  ferro: { name: { en: 'Iron', it: 'Ferro' }, note: { en: 'Satin black-brown', it: 'Nero bruno satinato' }, color: '#33261f', edge: '#8a5a3c', roughness: 0.45, speckle: 0.5 },
};

export const COLLECTIONS: Record<Collection, { name: Text; note: Text }> = {
  tavola: { name: { en: 'Tavola', it: 'Tavola' }, note: { en: 'For the everyday table', it: 'Per la tavola di ogni giorno' } },
  fiori: { name: { en: 'Fiori', it: 'Fiori' }, note: { en: 'For flowers and water', it: 'Per fiori e acqua' } },
  fuoco: { name: { en: 'Fuoco', it: 'Fuoco' }, note: { en: 'Wood-fired, every piece marked by the kiln', it: 'Cotti a legna, ogni pezzo segnato dal forno' } },
};

export const PIECES: Piece[] = [
  { id: 'tazza', collection: 'tavola', form: 'cup', price: 2800, size: { h: 82, d: 86 }, capacityMl: 250, care: 'dishwasher', glazes: ['latte', 'turchese', 'cobalto', 'miele'],
    name: { en: 'Cup', it: 'Tazza' }, blurb: { en: 'A straight cup for coffee with milk, thrown thin at the lip.', it: 'Tazza dritta per il caffellatte, tornita sottile sul bordo.' } },
  { id: 'mug', collection: 'tavola', form: 'mug', price: 3200, size: { h: 96, d: 84 }, capacityMl: 320, care: 'dishwasher', glazes: ['latte', 'ramina', 'cobalto'],
    name: { en: 'Mug', it: 'Mug' }, blurb: { en: 'A pulled handle that fits three fingers.', it: 'Manico tirato a mano, entrano tre dita.' } },
  { id: 'ciotola', collection: 'tavola', form: 'bowl', price: 3400, size: { h: 70, d: 150 }, capacityMl: 600, care: 'dishwasher', glazes: ['latte', 'turchese', 'miele', 'ferro'],
    name: { en: 'Bowl', it: 'Ciotola' }, blurb: { en: 'Soup, salad, fruit. A wide foot so it sits steady.', it: 'Zuppa, insalata, frutta. Piede largo, sta ferma.' } },
  { id: 'piattino', collection: 'tavola', form: 'sideplate', price: 2600, size: { h: 22, d: 200 }, care: 'dishwasher', glazes: ['latte', 'turchese', 'cobalto'],
    name: { en: 'Side plate', it: 'Piattino' }, blurb: { en: 'Bread, cheese, a slice of cake.', it: 'Pane, formaggio, una fetta di torta.' } },
  { id: 'piatto', collection: 'tavola', form: 'plate', price: 3800, size: { h: 26, d: 270 }, care: 'dishwasher', glazes: ['latte', 'ramina', 'ferro'],
    name: { en: 'Dinner plate', it: 'Piatto piano' }, blurb: { en: 'A low rim that stops the sauce, not the fork.', it: 'Bordo basso: ferma il sugo, non la forchetta.' } },
  { id: 'vasetto', collection: 'fiori', form: 'budvase', price: 3600, size: { h: 120, d: 70 }, care: 'hand', glazes: ['turchese', 'ramina', 'cobalto', 'miele'],
    name: { en: 'Bud vase', it: 'Vasetto' }, blurb: { en: 'One stem, a narrow neck that holds it upright.', it: 'Un solo stelo, collo stretto che lo tiene dritto.' } },
  { id: 'vaso', collection: 'fiori', form: 'vase', price: 9800, size: { h: 300, d: 160 }, care: 'hand', glazes: ['latte', 'cobalto', 'ferro'],
    name: { en: 'Tall vase', it: 'Vaso alto' }, blurb: { en: 'For branches. Thrown in two parts and joined.', it: 'Per i rami. Tornito in due parti e unito.' } },
  { id: 'brocca', collection: 'fiori', form: 'pitcher', price: 7400, size: { h: 210, d: 140 }, capacityMl: 1200, care: 'hand', glazes: ['latte', 'ramina', 'miele'],
    name: { en: 'Pitcher', it: 'Brocca' }, blurb: { en: 'Water at the table or flowers on it; the lip pours clean.', it: "Acqua in tavola o fiori sopra; il beccuccio non sgocciola." } },
  { id: 'chawan', collection: 'fuoco', form: 'teabowl', price: 5200, size: { h: 80, d: 120 }, capacityMl: 350, care: 'hand', glazes: ['miele', 'ferro'],
    name: { en: 'Tea bowl', it: 'Ciotola da tè' }, blurb: { en: 'Two days in the wood kiln; ash settles where it likes.', it: 'Due giorni nel forno a legna; la cenere si posa dove vuole.' } },
  { id: 'barattolo', collection: 'fuoco', form: 'jar', price: 6800, size: { h: 150, d: 120 }, capacityMl: 900, care: 'hand', glazes: ['ramina', 'miele', 'ferro'],
    name: { en: 'Lidded jar', it: 'Barattolo' }, blurb: { en: 'Salt, sugar, coffee beans. The lid is fitted to its own jar.', it: 'Sale, zucchero, caffè. Il coperchio è fatto per il suo barattolo.' } },
  { id: 'vassoio', collection: 'fuoco', form: 'dish', price: 8600, size: { h: 45, d: 340 }, care: 'hand', glazes: ['latte', 'miele', 'ferro'],
    name: { en: 'Serving dish', it: 'Vassoio' }, blurb: { en: 'Wide and shallow, for the middle of the table.', it: 'Largo e basso, per il centro della tavola.' } },
  { id: 'candela', collection: 'fuoco', form: 'candle', price: 2400, size: { h: 60, d: 90 }, care: 'hand', glazes: ['latte', 'ferro', 'turchese'],
    name: { en: 'Candle holder', it: 'Portacandela' }, blurb: { en: 'For a short church candle; catches the wax.', it: 'Per una candela bassa; raccoglie la cera.' } },
];

export const sku = (pieceId: string, glaze: GlazeId) => `${pieceId}-${glaze}`;

export function parseSku(s: string): { piece: Piece; glaze: GlazeId } | null {
  const i = s.lastIndexOf('-');
  const piece = PIECES.find(p => p.id === s.slice(0, i));
  const glaze = s.slice(i + 1) as GlazeId;
  return piece && piece.glazes.includes(glaze) ? { piece, glaze } : null;
}

export const ALL_SKUS = PIECES.flatMap(p => p.glazes.map(g => sku(p.id, g)));
