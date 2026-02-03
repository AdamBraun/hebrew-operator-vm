import {
  alephOp,
  ayinOp,
  hetOp,
  kafOp,
  lamedOp,
  peOp,
  qofOp,
  reshOp,
  shinOp,
  tavOp,
  tetOp,
  tsadiOp,
  zayinOp
} from "./basic";
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
  ת: tavOp,
  ...finalsMap
};
