import { alephOp } from "./aleph";
import { ayinOp } from "./ayin";
import { kafOp } from "./kaf";
import { qofOp } from "./qof";
import { reshOp } from "./resh";
import { hetOp } from "./het";
import { lamedOp } from "./lamed";
import { peOp } from "./pe";
import { shinOp } from "./shin";
import { tavOp } from "./tav";
import { tetOp } from "./tet";
import { tsadiOp } from "./tsadi";
import { zayinOp } from "./zayin";
import { betOp } from "./bet";
import { daletOp } from "./dalet";
import { gimelOp } from "./gimel";
import { heOp } from "./he";
import { finalsMap } from "./finals";
import { memOp } from "./mem";
import { nunOp } from "./nun";
import { samekhOp } from "./samekh";
import { vavOp } from "./vav";
import { yodOp } from "./yod";
import { LetterOp } from "./types";

export type LetterRegistry = Record<string, LetterOp>;
export type CompositePolicy = {
  precedence: "read_first";
  shape_effect_scope: "routing";
};

export type CompositeLetter = {
  id: string;
  read: string;
  shape: string;
  composite_policy: CompositePolicy;
};

export type CompositeRegistry = Record<string, CompositeLetter>;

export const letterRegistry: LetterRegistry = {
  א: alephOp,
  ב: betOp,
  ג: gimelOp,
  ד: daletOp,
  ה: heOp,
  ו: vavOp,
  ז: zayinOp,
  ח: hetOp,
  ט: tetOp,
  י: yodOp,
  כ: kafOp,
  ל: lamedOp,
  מ: memOp,
  נ: nunOp,
  ס: samekhOp,
  ע: ayinOp,
  פ: peOp,
  צ: tsadiOp,
  ק: qofOp,
  ר: reshOp,
  ש: shinOp,
  שׁ: shinOp,
  שׂ: samekhOp,
  ת: tavOp,
  ...finalsMap
};

export const compositeRegistry: CompositeRegistry = {
  שׂ: {
    id: "SIN_COMPOSITE",
    read: "ס",
    shape: "ש",
    composite_policy: {
      precedence: "read_first",
      shape_effect_scope: "routing"
    }
  }
};
